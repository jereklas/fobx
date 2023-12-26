import * as fobx from "../../src";

beforeAll(() => {
  fobx.configure({ enforceActions: false });
});

test("cascading active state (form 1)", function () {
  const Store = function () {
    fobx.extendObservable(this, { _activeItem: null });
  };
  Store.prototype.activeItem = function (item) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const _this = this;

    if (arguments.length === 0) return this._activeItem;

    fobx.runInAction(function () {
      if (_this._activeItem === item) return;
      if (_this._activeItem) _this._activeItem.isActive = false;
      _this._activeItem = item;
      if (_this._activeItem) _this._activeItem.isActive = true;
    });
  };

  const Item = function () {
    fobx.extendObservable(this, { isActive: false });
  };

  const store = new Store();
  const item1 = new Item(),
    item2 = new Item();
  expect(store.activeItem()).toBe(null);
  expect(item1.isActive).toBe(false);
  expect(item2.isActive).toBe(false);

  store.activeItem(item1);
  expect(store.activeItem()).toBe(item1);
  expect(item1.isActive).toBe(true);
  expect(item2.isActive).toBe(false);

  store.activeItem(item2);
  expect(store.activeItem()).toBe(item2);
  expect(item1.isActive).toBe(false);
  expect(item2.isActive).toBe(true);

  store.activeItem(null);
  expect(store.activeItem()).toBe(null);
  expect(item1.isActive).toBe(false);
  expect(item2.isActive).toBe(false);
});

test("cascading active state (form 2)", function () {
  const Store = function () {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const _this = this;
    fobx.extendObservable(this, { activeItem: null });

    fobx.autorun(function () {
      if (_this._activeItem === _this.activeItem) return;
      if (_this._activeItem) _this._activeItem.isActive = false;
      _this._activeItem = _this.activeItem;
      if (_this._activeItem) _this._activeItem.isActive = true;
    });
  };

  const Item = function () {
    fobx.extendObservable(this, { isActive: false });
  };

  const store = new Store();
  const item1 = new Item(),
    item2 = new Item();
  expect(store.activeItem).toBe(null);
  expect(item1.isActive).toBe(false);
  expect(item2.isActive).toBe(false);

  store.activeItem = item1;
  expect(store.activeItem).toBe(item1);
  expect(item1.isActive).toBe(true);
  expect(item2.isActive).toBe(false);

  store.activeItem = item2;
  expect(store.activeItem).toBe(item2);
  expect(item1.isActive).toBe(false);
  expect(item2.isActive).toBe(true);

  store.activeItem = null;
  expect(store.activeItem).toBe(null);
  expect(item1.isActive).toBe(false);
  expect(item2.isActive).toBe(false);
});

test("efficient selection", function () {
  function Item(value) {
    fobx.extendObservable(this, {
      selected: false,
      value: value,
    });
  }

  function Store() {
    this.prevSelection = null;
    fobx.extendObservable(this, {
      selection: null,
      items: [new Item(1), new Item(2), new Item(3)],
    });
    fobx.autorun(() => {
      if (this.previousSelection === this.selection) return true; // converging condition
      if (this.previousSelection) this.previousSelection.selected = false;
      if (this.selection) this.selection.selected = true;
      this.previousSelection = this.selection;
    });
  }

  const store = new Store();

  expect(store.selection).toBe(null);
  expect(
    store.items.filter(function (i) {
      return i.selected;
    }).length
  ).toBe(0);

  store.selection = store.items[1];
  expect(
    store.items.filter(function (i) {
      return i.selected;
    }).length
  ).toBe(1);
  expect(store.selection).toBe(store.items[1]);
  expect(store.items[1].selected).toBe(true);

  store.selection = store.items[2];
  expect(
    store.items.filter(function (i) {
      return i.selected;
    }).length
  ).toBe(1);
  expect(store.selection).toBe(store.items[2]);
  expect(store.items[2].selected).toBe(true);

  store.selection = null;
  expect(
    store.items.filter(function (i) {
      return i.selected;
    }).length
  ).toBe(0);
  expect(store.selection).toBe(null);
});
