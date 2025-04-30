# FobX

FobX is a state management library inspired by the great work of
[MobX](https://github.com/mobxjs/mobx), and functionally, is nearly identical
for most use cases. The entire library has been written from scratch with
tree-shaking, bundle size, and performance in mind. The goal of FobX is not to
be a direct replacement of MobX and therefore will not attempt to maintain
feature parity with it.

---

The following sub packages contain additional details:

- [@fobx/core](./core/README.md) - The core framework agnostic library.
- [@fobx/react](./react/README.md) - The `observer` reaction plus other goodies
  for development with React.
- [@fobx/preact](./preact/README.md) - The `observer` reaction plus other
  goodies for development with Preact.
