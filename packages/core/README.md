# @fobx/core

## TODO List

1. `observableObject` needs to handle property add + delete?
1. Need to fix ID generations to work with global state instead of instance state.
1. Need to publish initial packages.
   1. figure out what bundles need to be included.
1. Find and address any `TODO:` comments in the code.

## Notes

1. Array functions with callbacks (filter, forEach, every, etc...) return the non-proxied array as the 3rd argument of
   the callback instead of the proxy. This is for performance related reasons. Consumers have access to the proxied
   array (they're calling the function on it) if they need to do something with.
