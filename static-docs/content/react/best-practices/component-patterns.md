---
title: Component Patterns
description: Best practices for structuring React components with FobX.
navTitle: Component Patterns
navSection: ["@fobx/react", "Best Practices"]
navOrder: 0
navSectionOrder: 4
---

## Small observer components

Wrap small, focused components with `observer`. Each component tracks only the
observables it reads, so smaller components re-render less:

```tsx
// ❌ One large component — any tracked change re-renders everything it contains
const App = observer(() => (
  <div>
    <h1>{store.title}</h1>
    <ul>{store.items.map((item) => <li key={item.id}>{item.name}</li>)}</ul>
    <p>Total: {store.total}</p>
  </div>
))

// ✅ Split into focused components
const Title = observer(() => <h1>{store.title}</h1>)
const ItemList = observer(() => (
  <ul>{store.items.map((item) => <li key={item.id}>{item.name}</li>)}</ul>
))
const Total = observer(() => <p>Total: {store.total}</p>)

const App = () => (
  <div>
    <Title />
    <ItemList />
    <Total />
  </div>
)
```

## Read late, not early

Observable reads must happen inside the `observer` render body. Avoid
destructuring or reading observables before the component renders:

```tsx
// ❌ Reading before the tracked render starts — not tracked
const name = store.name
const count = store.count
const BadComponent = observer(() => <p>{name}: {count}</p>)

// ✅ Reading inside the tracked render
const GoodComponent = observer(({ store }: { store: Store }) => (
  <p>{store.name}: {store.count}</p>
))
```

Destructuring inside the `observer` callback is fine. What matters is when the
observable property access happens.

## Callbacks and event handlers

Event handlers run outside the tracking context, so they can safely read and
write observables. Use transactions for multi-property updates:

```tsx
const Form = observer(() => {
  const handleSubmit = () => {
    // This runs outside render — mutations are fine
    store.submit()
  }

  return <button onClick={handleSubmit}>Submit</button>
})
```

## Local state: `useViewModel` vs `useState`

| Scenario                                        | Recommendation                                   |
| ----------------------------------------------- | ------------------------------------------------ |
| Simple boolean/number/string                    | `useState` (React built-in)                      |
| Complex state with derived values               | `useViewModel`                                   |
| State with side effects (timers, subscriptions) | `useViewModel` with `onConnect`/`onDisconnect`   |
| State shared between components                 | External store (`observable` / `makeObservable`) |

`onConnect()` and `onDisconnect()` run via `useEffect`, so keep them idempotent
under React 18 StrictMode development replay.

```tsx
// Simple toggle — useState is fine
function Toggle() {
  const [open, setOpen] = useState(false)
  return (
    <button onClick={() => setOpen(!open)}>{open ? "Close" : "Open"}</button>
  )
}

// Complex form — useViewModel shines
class SearchVM extends ViewModel<{ onResults: (r: Result[]) => void }> {
  query = ""
  results: Result[] = []
  loading = false

  constructor(props: { onResults: (r: Result[]) => void }) {
    super(props)
    observable(this)
  }

  get hasResults() {
    return this.results.length > 0
  }

  *search() {
    this.loading = true
    const res = yield fetch(`/api/search?q=${encodeURIComponent(this.query)}`)
    this.results = yield res.json()
    this.loading = false
    this.props.onResults(this.results)
  }
}
```

## Passing observables through context

You can pass stores via React context. Just make sure consuming components are
wrapped in `observer`:

```tsx
const StoreContext = React.createContext<AppStore>(null!)

const StoreProvider = ({ children }: { children: React.ReactNode }) => {
  const [store] = useState(() => new AppStore())
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

const Display = observer(() => {
  const store = useContext(StoreContext)
  return <p>{store.displayValue}</p>
})
```

## Avoid unnecessary `observer` wrapping

Components that don't read any observables don't need `observer`:

```tsx
// ✅ No observables read — no observer needed
function Layout({ children }: { children: React.ReactNode }) {
  return <div className="layout">{children}</div>
}

// ✅ Reads observables — needs observer
const Header = observer(() => <h1>{store.title}</h1>)
```
