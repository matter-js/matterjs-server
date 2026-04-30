# OS Requirements

Matter is based on IPv6 link-local multicast protocols and thus running the Matter Server (or developing it) is not as straightforward as any other application, mostly due to the bad shape of IPv6 support in various Linux distributions, let alone the IPv6 Neighbor
Discovery Protocol, which is required for Thread.

Additionally, for node.js to work correctly with BLE commissioning, some additional requirements need to be met.

## Networking

Matter uses link-local multicast protocols which do not work across different LANs or VLANs so best to use either a complete flat network or ensure that the machine running Matter Server is on the same (v)LAN as the devices, any border routers and the phone/device used for commissioning.

The host network interface needs IPv6 support enabled.

Be aware of any (semi) professional networking gear such as Unifi or Omada which has options to filter multicast traffic, often called something like "Multicast optimizations" or something along those lines. Disable such features, they are helpful in a high density enterprise network, but they're killing domestic protocols that rely on multicast like Matter, Airplay etc.

Also do not enable any mdns forwarders on the network (the option is called mDNS on Unifi for example) as they tend to corrupt or severely hinder the Matter packets on the network.

In some cases it is known that IGMP/MLD snopping implementations on network gear may help or hinder Matter traffic. Play with these options if you have network equipment that offer it.

As a general rule of thumb, if you use standard, home user oriented network equipment, you have the highest rate of success with Matter.

## Operating system

The only supported operating systems for developing or running the Matter Server are (recent) versions of (64 bits) MacOS and a very recent distribution (including kernel) of Linux. Running it on non 64 bits architecture or another operating system (even WSL) is not supported.

For a MacOS (development) environment, things will work fine out of the box from MacOS 14 or higher (arm-based CPU). In combination with a python venv, it makes up for the recommended development environment for working on the Matter codebase.

For a Linux operating system, keep the following recommendations in mind:

> your host must process ICMPv6 Router Advertisements. See the [openthread.io
> Bidirectional IPv6 Connectivity code labs](https://openthread.io/codelabs/openthread-border-router#6)
> on how-to setup your host correctly. Note that NetworkManager has its own ICMPv6
> Router Advertisement processing. A recent version of NetworkManager is
> necessary, and there are still known issues (see NetworkManager issue
> [#1232](https://gitlab.freedesktop.org/NetworkManager/NetworkManager/-/issues/1232)).

The Home Assistant Operating System 10 and newer correctly processes ICMPv6 Router Advertisements. The Matter Server is provided as an add-on to that operating system, thus including all the required fixes.

### Requirements to communicate with Thread devices through Thread border routers

For communication through Thread border routers which are not running on the same
host as the Matter Controller server to work, IPv6 routing needs to be properly
working. IPv6 routing is largely setup automatically through the IPv6 Neighbor
Discovery Protocol, specifically the Route Information Options (RIO). However,
if IPv6 Neighbor Discovery RIO's are processed, and processed correctly depends on the network
management software your system is using. There may be bugs and caveats in
processing this Route Information Options.

In general, make sure the kernel option `CONFIG_IPV6_ROUTER_PREF` is enabled and
that IPv6 forwarding is disabled (sysctl variable `net.ipv6.conf.all.forwarding`).
If IPv6 forwarding is enabled, the Linux kernel doesn't employ reachability
probing (RFC 4191), which can lead to longer outages (up to 30min) until
network changes are detected.

If you are using NetworkManager, make sure to use at least NetworkManager 1.42.
Previous versions lose track of routes and stale routes can lead to unreachable
Thread devices. All current released NetworkManager versions can't handle
multiple routes to the same network properly. This means if you have multiple
Thread border routers, the fallback won't work immediately (see [NetworkManager
issue #1232](https://gitlab.freedesktop.org/NetworkManager/NetworkManager/-/issues/1232)).

We currently don't have experience with systemd-networkd. It seems to have its
own IPv6 Neighbor Discovery Protocol handling.

If you don't use NetworkManager or systemd-networkd, you can use the kernel's
IPv6 Neighbor Discovery Protocol handling.

Make sure the kernel options `CONFIG_IPV6_ROUTE_INFO` is enabled and the
following sysctl variables are set:

```sh
sysctl -w net.ipv6.conf.wlan0.accept_ra=1
sysctl -w net.ipv6.conf.wlan0.accept_ra_rt_info_max_plen=64
```

**DO NOT** rely on `sysctl -w` alone if NetworkManager or systemd-networkd manages the interface — they override runtime sysctl values. Set the values in the network manager's own configuration files (or on the connection profile) so they survive interface restarts.

If your system has IPv6 forwarding enabled (not recommended, see above), you'll
have to use `2` for the accept_ra variable. See also the [Thread Border Router - Bidirectional IPv6 Connectivity and DNS-Based Service Discovery codelab](https://openthread.io/codelabs/openthread-border-router#6).

### Multiple Thread Border Routers (multi-TBR)

**DO NOT** apply conntrack-based firewall rules to traffic **forwarded** between the Thread interface and the LAN on a Thread Border Router itself, when multiple TBRs share the same Thread network. A single Matter flow can ingress one TBR and egress another, so each TBR's conntrack only ever sees half the flow and will drop it.

This applies only to the TBR's forwarding/router role. It does **not** affect conntrack on the Matter Server's own host (see [Stateful firewalls](#stateful-firewalls-host-vm-hypervisor) below) — there, traffic of both directions are observed by the same firewall which makes conntrack work correctly.

## Stateful firewalls (host, VM, hypervisor)

If a stateful firewall sits on the path between the Matter Server and the Thread Border Router (host firewall, VM hypervisor firewall, container host firewall), the Linux conntrack default for UDP streams (120 s) drops reports from battery-powered (sleepy) Matter devices, whose report intervals are several minutes long.

**DO** check `nf_conntrack_udp_timeout_stream` and raise it to at least `1800` (we recommend `3600`) on every kernel that filters Matter traffic:

```sh
# Skip if no stateful firewall is in the path. Otherwise:
sysctl net.netfilter.nf_conntrack_udp_timeout_stream 2>/dev/null
# Absent / "unknown key" → conntrack module not loaded → nothing to do.
# Present and < 1800 → raise it:
sudo sysctl -w net.netfilter.nf_conntrack_udp_timeout_stream=3600
echo 'net.netfilter.nf_conntrack_udp_timeout_stream = 3600' \
  | sudo tee /etc/sysctl.d/99-matter.conf
# Present and ≥ 1800 → done.
```

**DO** apply this on the kernel that actually filters the packets:

- Bare-metal: the host itself.
- VM with hypervisor firewall (e.g. Proxmox per-VM firewall, vSphere DFW): the **hypervisor** kernel. Setting it inside the guest has no effect.
- Docker on Linux with firewalld (Fedora/RHEL default) or ufw (Ubuntu, when enabled): the Docker **host**.
- Home Assistant OS via the Supervisor: usually fine out of the box. Only worry if you have added a custom firewall layer.

**DO NOT** filter Matter UDP traffic by destination port. The controller binds an ephemeral port, and device source ports also vary.

**DO NOT** pin firewall rules to UDP/5540. Most devices use it, but not all.

If you must filter, scope rules by source IPv6 prefix (Thread ULA + OMR prefix) or by interface — never by port.

Diagnostic sentinel: a per-instance firewall chain drop counter climbing in step with battery-device report cycles while your "Matter" ACCEPT rule shows zero hits → conntrack timeout is the cause.

## VM and container deployments

**DO** give the Matter Server host (or VM) a network interface directly on the network where the Thread Border Router lives. Bridged/NAT networking combined with Matter UDP unicast traffic is unreliable.

**DO** set the IPv6 sysctls (`accept_ra`, `accept_ra_rt_info_max_plen`, `forwarding=0`) **inside** the VM guest as well, not just on the hypervisor.

**DO** run the Docker image with `--network=host`. Bridge networking will not work. Note that `--network=host` bypasses Docker's own iptables rules but **not** firewalld or ufw on the host kernel — see [Stateful firewalls](#stateful-firewalls-host-vm-hypervisor) above.

**DO NOT** enable mDNS reflectors or Avahi forwarders between network segments.

## Bluetooth Low Energy requirements

When working without Docker, please see the BLE requirements for your platform in the ["noble" relevant BLE documentation](https://github.com/matter-js/matter.js/tree/main/packages/nodejs-ble#prerequisites-and-limitations).
