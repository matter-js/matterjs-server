/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Minimal XML element tree. Only what the ZAP cluster XML generator needs: tag name, attributes,
 * child elements, and direct text content. No namespaces, no CDATA, no mixed-content ordering.
 */
export interface XmlElement {
    tag: string;
    attrs: Record<string, string>;
    children: XmlElement[];
    text: string;
}

const ENTITIES: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
};

function decodeEntities(raw: string): string {
    return raw.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
        if (entity[0] === "#") {
            const codePoint = entity[1] === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
            return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
        }
        return ENTITIES[entity] ?? match;
    });
}

/** Finds the unquoted `>` that closes a tag starting at `start` (which must point at `<`). */
function findTagEnd(source: string, start: number): number {
    let inQuote: '"' | "'" | undefined;
    for (let i = start + 1; i < source.length; i++) {
        const char = source[i];
        if (inQuote) {
            if (char === inQuote) inQuote = undefined;
            continue;
        }
        if (char === '"' || char === "'") {
            inQuote = char;
        } else if (char === ">") {
            return i;
        }
    }
    throw new Error(`Unterminated tag starting at offset ${start}`);
}

function parseAttrs(tagContent: string): { name: string; attrs: Record<string, string> } {
    const nameMatch = /^[a-zA-Z_][-\w.:]*/.exec(tagContent);
    if (!nameMatch) throw new Error(`Malformed tag: <${tagContent}>`);
    const name = nameMatch[0];
    const attrs: Record<string, string> = {};
    const attrPattern = /([a-zA-Z_][-\w.:]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let match: RegExpExecArray | null;
    while ((match = attrPattern.exec(tagContent.slice(name.length)))) {
        attrs[match[1]] = decodeEntities(match[3] ?? match[4] ?? "");
    }
    return { name, attrs };
}

/**
 * Parses an XML document into a synthetic `#document` root element wrapping the top-level elements.
 * Comments, processing instructions, and doctypes are skipped.
 */
export function parseXml(source: string): XmlElement {
    const root: XmlElement = { tag: "#document", attrs: {}, children: [], text: "" };
    const stack: XmlElement[] = [root];
    let i = 0;

    while (i < source.length) {
        const ltIndex = source.indexOf("<", i);
        if (ltIndex === -1) break;

        if (ltIndex > i) {
            const text = decodeEntities(source.slice(i, ltIndex));
            stack[stack.length - 1].text += text;
        }

        if (source.startsWith("<!--", ltIndex)) {
            const end = source.indexOf("-->", ltIndex + 4);
            i = end === -1 ? source.length : end + 3;
            continue;
        }
        if (source.startsWith("<?", ltIndex)) {
            const end = source.indexOf("?>", ltIndex + 2);
            i = end === -1 ? source.length : end + 2;
            continue;
        }
        if (source.startsWith("<!", ltIndex)) {
            const end = source.indexOf(">", ltIndex + 2);
            i = end === -1 ? source.length : end + 1;
            continue;
        }
        if (source.startsWith("</", ltIndex)) {
            const end = source.indexOf(">", ltIndex + 2);
            if (end === -1) throw new Error("Unterminated closing tag");
            if (stack.length <= 1) throw new Error(`Unmatched closing tag: ${source.slice(ltIndex, end + 1)}`);
            stack.pop();
            i = end + 1;
            continue;
        }

        const tagEnd = findTagEnd(source, ltIndex);
        const rawContent = source.slice(ltIndex + 1, tagEnd);
        const selfClosing = rawContent.endsWith("/");
        const { name, attrs } = parseAttrs(selfClosing ? rawContent.slice(0, -1) : rawContent);
        const element: XmlElement = { tag: name, attrs, children: [], text: "" };
        stack[stack.length - 1].children.push(element);
        if (!selfClosing) stack.push(element);
        i = tagEnd + 1;
    }

    if (stack.length !== 1) {
        throw new Error(
            `Unclosed tag(s): ${stack
                .slice(1)
                .map(e => e.tag)
                .join(", ")}`,
        );
    }
    return root;
}

export function findAll(el: XmlElement, tag: string): XmlElement[] {
    return el.children.filter(c => c.tag === tag);
}

export function findFirst(el: XmlElement, tag: string): XmlElement | undefined {
    return el.children.find(c => c.tag === tag);
}

export function textOf(el: XmlElement): string {
    return el.text.trim();
}
