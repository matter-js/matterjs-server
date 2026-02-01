/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterNode } from "@matter-server/ws-client";
import { LitElement, css } from "lit";
import { property, state } from "lit/decorators.js";
// @ts-expect-error vis-network doesn't have proper type declarations for standalone export
import { DataSet, Network } from "vis-network/standalone";
import { ThemeService } from "../../util/theme-service.js";
import type { NetworkGraphEdge, NetworkGraphNode } from "./network-types.js";

/**
 * Base class for network graph components (Thread and WiFi).
 * Provides shared vis.js network initialization, highlighting, and theme support.
 */
export abstract class BaseNetworkGraph extends LitElement {
    @property({ type: Object })
    public nodes: Record<string, MatterNode> = {};

    @state()
    protected _selectedNodeId: number | string | null = null;

    protected _network?: Network;
    protected _nodesDataSet?: DataSet<NetworkGraphNode>;
    protected _edgesDataSet?: DataSet<NetworkGraphEdge>;
    protected _container?: HTMLDivElement;
    protected _resizeObserver?: ResizeObserver;
    protected _themeUnsubscribe?: () => void;
    protected _updateDebounceTimer?: ReturnType<typeof setTimeout>;

    /** Store original edge colors for restoration after highlighting */
    private _originalEdgeColors: Map<string, { color: string; highlight: string }> = new Map();

    protected _getFontColor(): string {
        return ThemeService.effectiveTheme === "dark" ? "#e0e0e0" : "#333333";
    }

    protected _getDimmedEdgeColor(): string {
        return ThemeService.effectiveTheme === "dark" ? "#555555" : "#cccccc";
    }

    /**
     * Returns physics options for the network. Override in subclasses for different behavior.
     */
    protected _getPhysicsOptions(): any {
        return {
            enabled: true,
            solver: "forceAtlas2Based",
            forceAtlas2Based: {
                gravitationalConstant: -70,
                centralGravity: 0.005,
                springLength: 130,
                springConstant: 0.08,
                damping: 0.4,
                avoidOverlap: 0.6,
            },
            stabilization: {
                enabled: true,
                iterations: 250,
                updateInterval: 25,
            },
        };
    }

    override updated(changedProperties: Map<string, unknown>): void {
        super.updated(changedProperties);

        // If container wasn't found in firstUpdated (empty state was rendered),
        // try to find and observe it now that it might have appeared
        if (!this._container && !this._resizeObserver) {
            this._tryAttachContainer();
        }

        if (changedProperties.has("nodes")) {
            this._debouncedUpdateGraph();
        }
    }

    /**
     * Try to find and attach the graph container if it wasn't available before.
     * This handles the case where empty state was rendered initially.
     */
    private _tryAttachContainer(): void {
        const container = this.shadowRoot?.querySelector(".graph-container") as HTMLDivElement;
        if (container) {
            this._container = container;
            this._resizeObserver = new ResizeObserver(entries => {
                const entry = entries[0];
                if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                    if (!this._network) {
                        this._initializeNetwork();
                    } else {
                        this._network.setSize(`${entry.contentRect.width}px`, `${entry.contentRect.height}px`);
                        this._network.redraw();
                    }
                }
            });
            this._resizeObserver.observe(this._container);
        }
    }

    /** Debounced graph update to avoid excessive redraws */
    protected _debouncedUpdateGraph(): void {
        if (this._updateDebounceTimer) {
            clearTimeout(this._updateDebounceTimer);
        }
        this._updateDebounceTimer = setTimeout(() => {
            this._updateGraph();
        }, 100);
    }

    override firstUpdated(): void {
        this._container = this.shadowRoot?.querySelector(".graph-container") as HTMLDivElement;
        if (this._container) {
            // Wait for container to have proper dimensions before initializing
            this._resizeObserver = new ResizeObserver(entries => {
                const entry = entries[0];
                if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                    if (!this._network) {
                        this._initializeNetwork();
                    } else {
                        // Resize existing network
                        this._network.setSize(`${entry.contentRect.width}px`, `${entry.contentRect.height}px`);
                        this._network.redraw();
                    }
                }
            });
            this._resizeObserver.observe(this._container);
        }

        // Subscribe to theme changes - refresh entire graph to update colors
        this._themeUnsubscribe = ThemeService.subscribe(() => {
            if (this._network && this._nodesDataSet) {
                const fontColor = this._getFontColor();

                // Update default font colors for new nodes
                this._network.setOptions({
                    nodes: {
                        font: {
                            color: fontColor,
                        },
                    },
                });

                // Regenerate node icons and edges with new theme colors
                this._updateGraph();

                // Update font color on all existing nodes in the dataset
                const allNodes = this._nodesDataSet.get();
                const nodeUpdates = allNodes.map((node: NetworkGraphNode) => ({
                    id: node.id,
                    font: { color: fontColor },
                }));
                this._nodesDataSet.update(nodeUpdates);

                // Force redraw
                this._network.redraw();
            }
        });
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this._resizeObserver?.disconnect();
        this._themeUnsubscribe?.();
        if (this._updateDebounceTimer) {
            clearTimeout(this._updateDebounceTimer);
        }
        this._nodesDataSet?.clear();
        this._edgesDataSet?.clear();
        this._network?.destroy();
        this._network = undefined;
        this._nodesDataSet = undefined;
        this._edgesDataSet = undefined;
        this._originalEdgeColors.clear();
    }

    protected _initializeNetwork(): void {
        if (!this._container) return;

        // Get actual dimensions
        const rect = this._container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return; // Wait for proper dimensions
        }

        this._nodesDataSet = new DataSet<NetworkGraphNode>();
        this._edgesDataSet = new DataSet<NetworkGraphEdge>();

        const options = {
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            autoResize: false, // We handle resize manually
            nodes: {
                shape: "image",
                size: 30,
                font: {
                    size: 12,
                    color: this._getFontColor(),
                },
                borderWidth: 2,
                borderWidthSelected: 3,
            },
            edges: {
                width: 2,
                smooth: {
                    type: "continuous",
                    roundness: 0.5,
                },
            },
            physics: this._getPhysicsOptions(),
            interaction: {
                hover: true,
                tooltipDelay: 200,
                hideEdgesOnDrag: true,
            },
        };

        this._network = new Network(
            this._container,
            {
                nodes: this._nodesDataSet,
                edges: this._edgesDataSet,
            },
            options,
        );

        // Handle node selection
        this._network.on("selectNode", (params: { nodes: (number | string)[] }) => {
            if (params.nodes.length > 0) {
                this._selectedNodeId = params.nodes[0];
                this._highlightConnections(this._selectedNodeId);
                this._dispatchNodeSelected(this._selectedNodeId);
            }
        });

        this._network.on("deselectNode", () => {
            this._selectedNodeId = null;
            this._clearHighlights();
            this._dispatchNodeSelected(null);
        });

        // Auto-fit after stabilization completes
        this._network.on("stabilizationIterationsDone", () => {
            // Fit with padding to keep nodes away from edges
            this._network?.fit({
                animation: {
                    duration: 500,
                    easingFunction: "easeInOutQuad",
                },
            });
        });

        // Also fit when physics fully stops (catches any drift after initial stabilization)
        this._network.on("stabilized", () => {
            this._network?.fit({
                animation: {
                    duration: 300,
                    easingFunction: "easeInOutQuad",
                },
            });
        });

        this._updateGraph();
    }

    /**
     * Returns true if the graph is initialized and ready for interaction.
     */
    public isReady(): boolean {
        return this._network !== undefined && this._nodesDataSet !== undefined;
    }

    /**
     * Fits all nodes into view.
     */
    public fit(): void {
        this._network?.fit({
            animation: {
                duration: 300,
                easingFunction: "easeInOutQuad",
            },
        });
    }

    /**
     * Selects a node by ID and focuses on it.
     */
    public selectNode(nodeId: number | string): void {
        if (!this._network) return;

        this._selectedNodeId = nodeId;
        this._network.selectNodes([nodeId]);
        this._highlightConnections(nodeId);
        this._dispatchNodeSelected(nodeId);

        // Focus on the selected node
        this._network.focus(nodeId, {
            scale: 1.2,
            animation: {
                duration: 500,
                easingFunction: "easeInOutQuad",
            },
        });
    }

    protected _dispatchNodeSelected(nodeId: number | string | null): void {
        this.dispatchEvent(
            new CustomEvent("node-selected", {
                detail: { nodeId },
                bubbles: true,
                composed: true,
            }),
        );
    }

    /**
     * Highlights edges connected to the selected node and makes neighbor nodes more prominent.
     */
    protected _highlightConnections(nodeId: number | string): void {
        if (!this._edgesDataSet || !this._nodesDataSet) return;

        // Store original colors before highlighting
        const allEdges = this._edgesDataSet.get();
        for (const edge of allEdges) {
            const edgeId = String(edge.id);
            if (!this._originalEdgeColors.has(edgeId)) {
                const colorObj = edge.color as { color: string; highlight: string };
                this._originalEdgeColors.set(edgeId, {
                    color: colorObj?.color ?? "#999999",
                    highlight: colorObj?.highlight ?? "#999999",
                });
            }
        }

        // Find all edges connected to this node
        const connectedEdges = this._edgesDataSet.get({
            filter: (edge: NetworkGraphEdge) => edge.from === nodeId || edge.to === nodeId,
        });

        // Get neighbor node IDs
        const neighborIds = new Set<number | string>();
        for (const edge of connectedEdges) {
            if (edge.from === nodeId) {
                neighborIds.add(edge.to);
            } else {
                neighborIds.add(edge.from);
            }
        }

        // Update edges - make connected ones thicker
        const dimmedColor = this._getDimmedEdgeColor();
        const edgeUpdates = allEdges.map((edge: NetworkGraphEdge) => {
            const isConnected = edge.from === nodeId || edge.to === nodeId;
            const originalColor = this._originalEdgeColors.get(String(edge.id));
            return {
                id: edge.id,
                width: isConnected ? 3 : 1,
                // Dim non-connected edges
                color: isConnected
                    ? { color: originalColor?.color, highlight: originalColor?.highlight }
                    : {
                          color: dimmedColor,
                          highlight: dimmedColor,
                      },
            };
        });
        this._edgesDataSet.update(edgeUpdates);

        // Update nodes - make neighbors more prominent
        const allNodes = this._nodesDataSet.get();
        const nodeUpdates = allNodes.map((node: NetworkGraphNode) => {
            const isNeighbor = neighborIds.has(node.id);
            const isSelected = node.id === nodeId;
            return {
                id: node.id,
                size: isSelected ? 40 : isNeighbor ? 35 : 25,
                font: {
                    size: isSelected ? 14 : isNeighbor ? 13 : 11,
                    color: this._getFontColor(),
                    bold: isSelected || isNeighbor ? { color: this._getFontColor() } : undefined,
                },
                opacity: isSelected || isNeighbor ? 1 : 0.5,
            };
        });
        this._nodesDataSet.update(nodeUpdates);
    }

    /**
     * Clears all highlights and restores default styling.
     */
    protected _clearHighlights(): void {
        if (!this._edgesDataSet || !this._nodesDataSet) return;

        // Restore edge widths and original colors
        const allEdges = this._edgesDataSet.get();
        const edgeUpdates = allEdges.map((edge: NetworkGraphEdge) => {
            const originalColor = this._originalEdgeColors.get(String(edge.id));
            return {
                id: edge.id,
                width: 2,
                color: originalColor ?? { color: "#999999", highlight: "#999999" },
            };
        });
        this._edgesDataSet.update(edgeUpdates);

        // Restore node sizes
        const allNodes = this._nodesDataSet.get();
        const nodeUpdates = allNodes.map((node: NetworkGraphNode) => ({
            id: node.id,
            size: 30,
            font: {
                size: 12,
                color: this._getFontColor(),
                bold: undefined,
            },
            opacity: 1,
        }));
        this._nodesDataSet.update(nodeUpdates);
    }

    /**
     * Clear stored edge colors when graph is updated (edges are recreated).
     */
    protected _clearOriginalEdgeColors(): void {
        this._originalEdgeColors.clear();
    }

    /**
     * Abstract method to be implemented by subclasses for graph-specific updates.
     */
    protected abstract _updateGraph(): void;

    static override styles = css`
        :host {
            display: block;
            width: 100%;
            height: 100%;
            min-height: 0;
        }

        .graph-container {
            width: 100%;
            height: 100%;
            background-color: var(--md-sys-color-surface, #fff);
            border-radius: 8px;
            border: 1px solid var(--md-sys-color-outline-variant, #ccc);
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--md-sys-color-on-surface-variant, #666);
            text-align: center;
            padding: 24px;
            box-sizing: border-box;
            background-color: var(--md-sys-color-surface, #fff);
            border-radius: 8px;
            border: 1px solid var(--md-sys-color-outline-variant, #ccc);
        }

        .empty-state p {
            margin: 8px 0;
        }

        .empty-state .hint {
            font-size: 0.875rem;
            opacity: 0.7;
        }
    `;
}
