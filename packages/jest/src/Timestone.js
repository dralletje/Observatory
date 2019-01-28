let { sortBy, partition } = require("lodash");

const Original_Date = Date;

const Mock_Date = Object.assign(
  function(value = Mock_Date.now()) {
    return new Original_Date(value);
  },
  {
    mocked_current_time: null,
    now: () => {
      if (Mock_Date.active) {
        const time = Mock_Date.mocked_current_time;
        Mock_Date.mocked_current_time = time + 1;
        return time;
      } else {
        return Original_Date.now();
      }
    },

    UTC: Original_Date.UTC,
    prototype: Original_Date.prototype,
    __original: Original_Date,
  }
);

/*:flow
type TTimer = {
  id: number,
  type: 'interval' | 'timeout',
  projected_time: number, // timestamp it is supposed to have it's next run
  duration: number, // Necessary for interval to repeat
  fn_to_execute: () => mixed,
};
type TImmediates = {
  id: number,
  fn_to_execute: () => mixed,
}
*/

class TimeStone {
  constructor(obj) {
    this.initial_id = 1;
    this.mocked_timers = [] /*: Array<TTimer>*/;
    this.mocked_immediates = [] /*: Array<TImmediates> */;
    this.active = false;

    this.mocks = {
      setInterval: (_setInterval) => (fn, duration) => {
        this.mocked_timers.push({
          id: this.initial_id,
          type: "interval",
          projected_time: duration,
          duration: duration,
          fn_to_execute: () => {
            // Reschedule the interval so it will run again
            setInterval(fn, duration);
            fn();
          },
        });
        this.initial_id = this.initial_id + 1;
        return this.initial_id;
      },
      setImmediate: (_setImmediate) => (fn) => {
        // fn();
        this.mocked_immediates.push({
          fn_to_execute: fn,
        });
      },
      setTimeout: (_setTimeout) => (fn, duration) => {
        this.mocked_timers.push({
          id: this.initial_id,
          type: "timeout",
          projected_time: duration,
          duration: duration,
          fn_to_execute: fn,
        });
        this.initial_id = this.initial_id + 1;
        return this.initial_id;
      },
      clearTimeout: (_clearTimeout) => (id) => {
        this.mocked_timers = this.mocked_timers.filter((x) => x.id !== id);
      },
      clearInterval: (_clearInterval) => (id) => {
        this.mocked_timers = this.mocked_timers.filter((x) => x.id !== id);
      },
    };

    this.original_functions = {};
    Object.entries(this.mocks).forEach(([key, mockFn]) => {
      if (typeof mockFn !== "function") {
        throw new Error(`MockFn not a function (key: '${key}')`);
      }

      this.original_functions[key] = obj[key];
      const with_original = mockFn(obj[key]);
      obj[key] = (...args) => {
        if (this.active) {
          return with_original(...args);
        } else {
          return this.original_functions[key](...args);
        }
      };
      obj[key].__original = this.original_functions[key];
    });
  }

  activate(base_time) {
    this.active = true;
    Mock_Date.active = true;
    Mock_Date.mocked_current_time = Number(base_time);
  }
  deactivate() {
    this.active = false;
    Mock_Date.active = false;

    this.mocked_timers = [];
    this.initial_id = 1;
  }

  async run_microtasks() {
    await new Promise((yell) => {
      this.original_functions.setImmediate(() => {
        yell();
      });
    });
  }

  async mock_forward_time(to_date, time_changed_callback) {
    // Try to resolve all the async/await statements inside by calling a real setImmediate.
    // NOTE This should be the only real setImmediate call inside the program, so would be last thing to run.
    // TODO If this does not resolve all of them, maybe do something with `process._getActiveRequests()`
    await this.run_microtasks();

    // Get the first timer that we need
    let now = Math.min(to_date, Mock_Date.mocked_current_time);
    let timers_coming_up = this.mocked_timers.filter(
      (timer) => now + timer.projected_time <= to_date
    );
    let timers = sortBy(timers_coming_up, (x) => x.projected_time);
    let next_timer = timers[0];

    // Run setImmediates before resolving promises inside of them
    let immediates = this.mocked_immediates;
    if (immediates.length !== 0) {
      this.mocked_immediates = [];
      for (let immediate of immediates) {
        immediate.fn_to_execute();
      }
    }

    // So this is a tricky part:
    // If the timer is supposed to actually execute now (because, say, `setTimeout(fn, 0)`),
    // we should execute these (so continue running this function)
    // but if it is not, we first do another round of possible setImmediates.
    if (immediates.length !== 0) {
      if (next_timer == null || next_timer.projected_time > 0) {
        return this.mock_forward_time(to_date, time_changed_callback);
      } else {
        // Again, just resolve all promises
        await this.run_microtasks();
      }
    }

    if (next_timer) {
      // Get all the timers set to execute at this time
      let [current_timers, pending_timers] = partition(
        this.mocked_timers,
        (x) => x.projected_time === next_timer.projected_time
      );

      // Remove current timer from the timers now already,
      // because we might get confused when there are timers added during the
      // execution of the current_timer
      this.mocked_timers = pending_timers.map((timer) => {
        return {
          ...timer,
          projected_time: timer.projected_time - next_timer.projected_time,
        };
      });

      // Set the current time to the point where the timer would run,
      // and then execute the timer!
      let last_mocked_time = Mock_Date.mocked_current_time;
      Mock_Date.mocked_current_time = Math.max(
        last_mocked_time,
        Mock_Date.mocked_current_time + next_timer.projected_time
      );
      if (typeof time_changed_callback === "function") {
        time_changed_callback({
          from: last_mocked_time,
          to: Mock_Date.mocked_current_time,
        });
      }

      for (let current_timer of current_timers) {
        current_timer.fn_to_execute();
      }

      // Retry this method, either executing the next timer or ending
      return this.mock_forward_time(to_date, time_changed_callback);
    } else {
      // Update the current time and end
      let time_increase = to_date.getTime() - Mock_Date.mocked_current_time;

      this.mocked_timers = this.mocked_timers.map((timer) => {
        return {
          ...timer,
          projected_time: timer.projected_time - time_increase,
        };
      });

      // Send last time change to the callback
      if (typeof time_changed_callback === "function") {
        time_changed_callback({
          from: Mock_Date.mocked_current_time,
          to: to_date.getTime(),
        });
      }
      Mock_Date.mocked_current_time = Math.max(
        to_date.getTime(),
        Mock_Date.mocked_current_time
      );
    }

    await this.run_microtasks();
  }
}

// Just in case this module gets re-required
if (global.Date.__timestone__) {
  module.exports = { TimeStone, timestone: global.Date.__timestone__ };
} else {
  global.Date = Mock_Date;
  let timestone = new TimeStone(global);
  global.Date.__timestone__ = timestone;
  module.exports = { TimeStone, timestone };
}
