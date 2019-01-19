let { timestone } = require('./Timestone.js');
let { JournalCollection } = require('./Journal.js');

const moment = require('moment');
const chalk = require('chalk');

// const ISODate = x => new Date(x);
// const NumberLong = x => Number(x);

global.jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000; // 10 second timeout

let my_journals = new JournalCollection();
let time_journal = my_journals.define_chapter('time');
let marker_journal = my_journals.define_chapter('markers');

const Observatory = {
  snapshot: () => my_journals.snapshot(),
  marker: ({ title }) => marker_journal.push({ title }),
  Journal: (name) => my_journals.define_chapter(name),

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
      timestone.activate();
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
        } else if (result.type === Observatory.SetImmediate) {

          // Just in case I need another SetImmediate
          await new Promise(yell => {
            setImmediate.__original(() => {
              yell()
            }, 0);
          });
          next = null;

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
