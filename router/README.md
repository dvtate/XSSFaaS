# Router
Thing that distributes jobs to workers

First draft probably in JS, final draft probably in C++

## Distribution Policies?
These rules are some things that users might want to use in order to pick the ideal workers for tasks
### Geography
- Closest to given spot on map
- Within borders of specific area
- Maximize geographic spread
### Devices
- Avoid reusing workers
- Prefer reusing workers
### Specs
- Prefer specific browser?
- Prefer compute
- Prefer bandwidth

## CDN?
Not gonna design this at first but will probably wanna have a system so that the connection between the router and the workers is minimized, probably multiple servers or sth?
