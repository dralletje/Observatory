let { flatten, sortBy } = require("lodash");
let EventEmitter = require('events')

let precondition = (condition, message = `Unmet precondition`) => {
  if (!condition) throw new Error(message);
};

class Journal extends EventEmitter {
  // Use my own EventEmitter so I can check on what valid events are

  constructor(name) {
    super();
    this.changes = [];
    this.name = name;
  }

  push({ type = "insert", ...change }) {
    // let stack = new Error().stack;
    // let stack_lines = stack
    //   .split("\n")
    //   .slice(1)
    //   .map((line) => {
    //     let match = line.match(/^\s*at .* \((.*)\)\s*$/);
    //     if (match == null) return null;
    //     let [_, file] = match;
    //     if (!file.includes("Jobletics")) return null;
    //     if (file.includes(__dirname)) return null;
    //     if (file.includes("__tests__")) return null;
    //     if (file.includes("__mocks__")) return null;
    //     if (file.includes("node_modules")) return null;
    //     return file;
    //   })
    //   .filter(Boolean)

    this.changes.push({
      change: change,
      at: new Date(),
      type: type,
    });
  }

  snapshot() {
    return this.changes.map((change) => {
      return {
        ...change,
        collectionName: this.name,
      };
    });
  }

  clear() {
    this.changes = [];
    this.emit('clear');
  }
}

class JournalCollection {
  constructor() {
    this.journals = [];
  }

  // I could do this with just a closure but this feels better stfu
  define_chapter(name) {
    let journal = new Journal(name);
    this.journals.push(journal);
    return journal;
  }

  snapshot() {
    return [
      this.creation,
      ...sortBy(
        flatten(this.journals.map((x) => x.snapshot())),
        (a) => a.at,
      ),
    ];
  }

  initialize({ timezone = 'GMT' } = {}) {
    this.journals.forEach((x) => x.clear());
    this.creation = {
      change: {
        timezone: timezone,
      },
      at: new Date(),
      type: "start",
      collectionName: "time",
    };
  }
}

module.exports = { JournalCollection };
