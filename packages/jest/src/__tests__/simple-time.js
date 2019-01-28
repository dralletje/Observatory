let Observatory = require('../Observatory.js');
let { round } = require('lodash')

it('should pass the time', Observatory.test(function*() {
  let now = Date.now();

  let ten_minutes = 10 * 60 * 1000;
  yield Observatory.Forward_Time(ten_minutes);

  let then = Date.now();

  expect(round(then - now, -2)).toEqual(ten_minutes);
}));

it('should run timer when passed', Observatory.test(function*() {
  // Set timer to 5 minutes
  let timer_has_run = false;
  setTimeout(() => {
    timer_has_run = true;
  }, 5 * 60 * 1000);

  let ten_minutes = 10 * 60 * 1000;
  yield Observatory.Forward_Time(ten_minutes);

  expect(timer_has_run).toEqual(true);
}));

it('should run nested timer', Observatory.test(function*() {
  // Set timer to 5 minutes
  let timer_has_run = false;
  setTimeout(() => {
    setTimeout(() => {
      timer_has_run = true;
    }, 2 * 60 * 1000)
  }, 2 * 60 * 1000);

  let ten_minutes = 10 * 60 * 1000;
  yield Observatory.Forward_Time(ten_minutes);

  expect(timer_has_run).toEqual(true);
}));

it('should run interval', Observatory.test(function*() {
  // Run every 4 minutes (which )
  let timer_run_count = 0;
  setInterval(() => {
    timer_run_count = timer_run_count + 1;
  }, 4 * 60 * 1000);

  let ten_minutes = 10 * 60 * 1000;
  yield Observatory.Forward_Time(ten_minutes);

  expect(timer_run_count).toEqual(2);
}));

it('should not run timer when not passed', Observatory.test(function*() {
  // Set timer to 20 minutes
  let timer_has_run = false;
  setTimeout(() => {
    timer_has_run = true;
  }, 20 * 60 * 1000);

  let ten_minutes = 10 * 60 * 1000;
  yield Observatory.Forward_Time(ten_minutes);

  expect(timer_has_run).toEqual(false);
}));

it('should run some timers, not others', Observatory.test(function*() {
  // Set timer to 20 minutes
  let timer_1_has_run = false;
  let timer_2_has_run = false;
  setTimeout(() => {
    timer_1_has_run = true;
  }, 5 * 60 * 1000);
  setTimeout(() => {
    timer_2_has_run = true;
  }, 20 * 60 * 1000);

  let ten_minutes = 10 * 60 * 1000;
  yield Observatory.Forward_Time(ten_minutes);

  expect(timer_1_has_run).toEqual(true);
  expect(timer_2_has_run).toEqual(false);
}));

it('should run a sequence of timers correctly', Observatory.test(function*() {
  let now = Date.now();

  let timers_in_seconds = [10, 60, 8 * 60, 12 * 60, 19 * 60];
  let timers_done = [];

  for (let seconds of timers_in_seconds) {
    setTimeout(() => {
      timers_done.push(Date.now() - now);
    }, seconds * 1000);
  }

  let twenty_minutes = 20 * 60 * 1000;
  yield Observatory.Forward_Time(twenty_minutes);

  for (let [index, seconds] of Object.entries(timers_in_seconds)) {
    expect(round(timers_done[index], -3)).toEqual(seconds * 1000);
  }
}));

it('should run a short timer', Observatory.test(function*() {
  // Set timer to 50 milliseconds
  let timer_has_run = false;
  setTimeout(() => {
    timer_has_run = true;
  }, 50);

  yield Observatory.Forward_Time(100); // Forward for 100 milliseconds

  expect(timer_has_run).toEqual(true);
}));
