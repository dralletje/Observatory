it('should match this snapshot', () => {
  expect({
    number: 10,
    null: null,
    array_empty: [],
    array_numbers: [1, 2, 3],
    object_empty: {},
    object: {
      simple_key: 'simple_value',
      "**!!## weird-key $$%%^^": "Weird value 123,.;][';`````']",
    },
    extra_key: null,
  }).toMatchSnapshot();
})
