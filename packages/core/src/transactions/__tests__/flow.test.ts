import { flow } from "../flow";

test("named generator functions supplied to flow is retained", () => {
  const f = flow(function* something() {
    yield Promise.resolve();
  });

  expect(f.name).toBe("something");
});
