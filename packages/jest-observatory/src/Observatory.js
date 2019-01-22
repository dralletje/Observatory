// Not my normal way to do it, but I need to make sure that
// Timestone is important before everything else, so it can mock the dates
let { timestone } = require('./Timestone.js');
let { JournalCollection } = require('./Journal.js');

let moment = require('moment');
let chalk = require('chalk');

// const ISODate = x => new Date(x);
// const NumberLong = x => Number(x);

const useful_times = {
  // It's actually a monday with is super helpful as well
  ten_am_januari_first_2018: new Date("2018-01-01T10:00:00.000Z").getTime(),
};

global.jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000; // 10 second timeout

let my_journals = new JournalCollection();
let time_journal = my_journals.define_chapter('time');
let marker_journal = my_journals.define_chapter('markers');

const Observatory = {
  snapshot: () => my_journals.snapshot(),
  marker: ({ title }) => marker_journal.push({ title }),
  Journal: (name) => my_journals.define_chapter(name),

  match_observations: async () => {
    let snapshot_data = Observatory.snapshot();

    let errors_before = expect.getState().suppressedErrors.length;
    expect(snapshot_data).toMatchSnapshot();
    let errors_after = expect.getState().suppressedErrors;

    if (errors_before !== errors_after.length) {
      let last_error = errors_after[errors_after.length - 1];

      // Update the stack for a nicer message
      // NOTE Disable when jest gives weird results
      last_error.message = last_error.message.replace(/expect\((.*)\)\.toMatchSnapshot\((.*)\)/, `Observatory.match_observations()`);
      last_error.stack = last_error.stack.replace(/at [^(]+ \([^)]+\)\n/, '')

      // Send new snapshot to observatory server
      try {
        let current_test = expect.getState();
        let { currentTestName, snapshotState } = current_test;
        let { _snapshotPath, _counters } = snapshotState;
        let counter = _counters.get(currentTestName)
        let snapshotName = `${currentTestName} ${counter}`;

        // jest.resetModules();
        jest.unmock('node-fetch');
        let fetch = jest.requireActual('node-fetch');

        let response = await fetch(`http://localhost:4000/api`, {
          method: 'post',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: 'live_test_result',
            data: {
              snapshot_path: _snapshotPath,
              snapshot_name: snapshotName,
              snapshot_data: snapshot_data,
            },
          }),
        });
        let result = await response.json();
      } catch (err) {
        // console.log(`!!! err:`, err)
      }
    }
  },

  add_less_precise_date_serializer: () => {
    // Take the milliseconds part of a date
    expect.addSnapshotSerializer({
      print(val, serialize, indent) {
        const new_val = new Date(val);
        new_val.setMilliseconds(0);
        return serialize(new_val);
      },

      test(val) {
        return val instanceof Date && val.getMilliseconds() !== 0;
      },
    });

    // Take the milliseconds part of a number that really looks like a date...
    // NOTE RISKYYYY
    expect.addSnapshotSerializer({
      print(val, serialize, indent) {
        const new_val = new Date(val);
        new_val.setMilliseconds(0);
        return serialize(new_val.getTime());
      },

      test(val) {
        let date = new Date(val);
        return typeof val === 'number' && date.getYear() === new Date().getYear() && date.getMilliseconds() !== 0;
      },
    });
  },

  // use `yield Observatory.Forward_Time(x)` to move to a certain point in time
  Forward_Time: duration => {
    return {
      type: Observatory.Forward_Time,
      duration: duration,
    };
  },

  SetImmediate: () => {
    return {
      type: Observatory.SetImmediate,
    };
  },

  test: generator => {
    return async () => {
      timestone.activate(useful_times.ten_am_januari_first_2018);
      my_journals.clear();

      const simulation = generator();

      let next = simulation.next();
      while (next.done === false) {
        const result = await next.value;

        // TODO Unsure if I need to have this
        // .... I guess have it, but with less then 10 seconds?
        // await timestone.mock_forward_time(
        //   moment().add({ seconds: 10 }).toDate(),
        // );

        // This makes /sure/ that async/await and .then calls have
        // all been resolved before moving on.
        await new Promise(yell => {
          setImmediate.__original(() => {
            yell()
          });
        });

        if (result == null) {
          next = simulation.next(result);
        } else if (typeof result.then === 'function') {
          // `yield` being used as `await` here
          // Going to propage that and just await the result
          next = simulation.next(await result);
        } else if (result.type === Observatory.Forward_Time) {

          const date_to = moment().add(result.duration).toDate();

          const perf_now = Date.__original.now();
          // prettier-ignore
          console.log(chalk.blue('[FORWARDING TIME]'), chalk.dim('from'), new Date(), chalk.dim('to'), date_to);
          await timestone.mock_forward_time(date_to, ({ from, to }) => {
            time_journal.push({
              type: 'forward',
              from: from,
              to: to,
            });
          });
          console.log(chalk.red('[FORWARDING TIME]'), chalk.dim('ended on'), new Date());

          // Let me know if the performance has gone haywire
          const perf_then = Date.__original.now();
          const duration = (perf_then - perf_now) / 1000;
          if (duration > 10) {
            console.log(chalk.green(`SLOW PERF ${duration}`));
          }

          next = simulation.next(result);
        } else {
          next = simulation.next(result);
        }
      }

      timestone.deactivate();
    };
  },
};

module.exports = Observatory;
