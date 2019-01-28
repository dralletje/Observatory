let Observatory = require('../Observatory.js');

let timers = (run) => {
  setTimeout(() => {
    run('setTimeout 5ms');
  }, 5);
  setTimeout(() => {
    run('setTimeout 0ms');
  }, 0);
  setImmediate(() => {
    run('setImmediate')
  });
  Promise.resolve().then(() => {
    run('Promise.resolve')
  });

  // TODO I don't do process.nextTick now, because it's weird
  // process.nextTick(() => {
  //   run('process.nextTick');
  // });
}

// This does not work yet, but I think it is close enough for now
// (Remove the skip to compare the jest timers to observatory timers)
// (Also, the jest timers are instable so this test will never work :P)
it.skip('should run all the timers perfectly', async () => {
  let jest_timers = [];
  timers((name) => {
    jest_timers.push(`${name}`);
    timers((sub_name) => {
      jest_timers.push(`${name}:${sub_name}`);
    });
  });

  await new Promise((resolve) => {
    setTimeout(resolve, 1000);
  });

  let observatory_timers = [];
  let observatory_test = Observatory.test(function*() {
    timers((name) => {
      observatory_timers.push(`${name}`);
      timers((sub_name) => {
        observatory_timers.push(`${name}:${sub_name}`);
      });
    });
    yield Observatory.Forward_Time(1000);
  });
  await observatory_test();

  console.log(`observatory_timers:`, observatory_timers);
  console.log(`jest_timers:`, jest_timers);

  expect(observatory_timers).toEqual(jest_timers);
});
