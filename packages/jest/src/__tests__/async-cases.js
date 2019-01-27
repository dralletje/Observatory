let Observatory = require('../Observatory.js');

let Bluebird = require('bluebird');

// let simple_journal = Observatory.Journal('simple');


it('should resolve lingering native promises', Observatory.test(function*() {
  // Run this, but don't await
  let has_resolved = false;
  (async () => {
    await Promise.resolve().then(() => Promise.resolve());
    // Some weird construction in the hope I can make it fail
    await new Promise((resolve) => {
      Promise.resolve().then(() => {
        resolve();
      });
    });
    await new Promise((resolve) => {
      Promise.resolve().then(() => {
        resolve();
      });
    });    await Promise.resolve().then(() => Promise.resolve());
    has_resolved = true;
  })();

  yield;

  expect(has_resolved).toEqual(true);
}));

it('should resolve lingering bluebird promises', Observatory.test(function*() {
  // Run this, but don't await
  let has_resolved = false;
  (async () => {
    await Bluebird.resolve().then(() => Bluebird.resolve());
    // Some weird construction in the hope I can make it fail
    await new Bluebird((resolve) => {
      Bluebird.resolve().then(() => {
        resolve();
      });
    });
    await new Bluebird((resolve) => {
      Bluebird.resolve().then(() => {
        resolve();
      });
    });
    await Bluebird.resolve().then(() => Bluebird.resolve());
    has_resolved = true;
  })();

  yield;

  expect(has_resolved).toEqual(true);
}));

it('should correctly handle process.nextTick', Observatory.test(function*() {
  let has_process_nexttick = false;
  process.nextTick(() => {
    has_process_nexttick = true;
  });

  // Not run immediately
  expect(has_process_nexttick).toEqual(false);

  yield;

  // Run later though
  expect(has_process_nexttick).toEqual(true);
}));

it('should correctly handle multiple setTimeouts', Observatory.test(function*() {
  let events = [];

  setTimeout(() => {
    events.push('setTimeout');
    Promise.resolve().then(() => {
      events.push('Promise.resolve');
    });
  }, 1000);
  setTimeout(() => {
    events.push('setTimeout');
    Promise.resolve().then(() => {
      events.push('Promise.resolve');
    });
  }, 1000);

  yield Observatory.Forward_Time(2000);

  expect(events).toEqual([
    'setTimeout',
    'setTimeout',
    'Promise.resolve',
    'Promise.resolve',
  ]);
}))

it('should correctly handle setImmediate', Observatory.test(function*() {
  let has_set_immediate = false;
  setImmediate(() => {
    has_set_immediate = true;
  });

  // Not run immediately
  expect(has_set_immediate).toEqual(false);

  yield;

  // Run later though
  expect(has_set_immediate).toEqual(true);
}))
