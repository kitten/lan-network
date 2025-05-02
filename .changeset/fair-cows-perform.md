---
'lan-network': patch
---

When matching a probed route, ignore internal interfaces. The probed route will match a VPN (virtual) interface when using it to tunnel all traffic, but is unlikely to be considered the local network by users.
