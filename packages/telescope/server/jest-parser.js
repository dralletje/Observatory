let chalk = require('chalk');

let parse_object_entry = (text) => {
  let match = text.match(/^\s*"(([^"]|\\")*[^\\]|)":/);

  if (match == null) {
    throw new Error(`Couldn't match in \n${chalk.red(`'${text}'`)}`);
  }

  let [matched_text, key] = match;
  let { sub_value, resulting_text } = parse_value(text.slice(matched_text.length));

  return { key: key, value: sub_value, resulting_text: resulting_text };
}

let parse_value = (text) => {
  let current_value = null;

  let date_match = text.match(/^\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z)/);
  if (date_match) {
    return {
      sub_value: new Date(date_match[1]),
      resulting_text: text.slice(date_match[0].length),
    };
  }

  let number_match = text.match(/^\s*(\d+(.\d+)?)/);
  if (number_match) {
    return {
      sub_value: Number(number_match[1]),
      resulting_text: text.slice(number_match[0].length),
    };
  }

  let true_match = text.match(/^\s*true/);
  if (true_match) {
    return {
      sub_value: true,
      resulting_text: text.slice(true_match[0].length),
    };
  }

  let false_match = text.match(/^\s*false/);
  if (false_match) {
    return {
      sub_value: false,
      resulting_text: text.slice(false_match[0].length),
    };
  }

  let null_match = text.match(/^\s*null/);
  if (null_match) {
    return {
      sub_value: null,
      resulting_text: text.slice(null_match[0].length),
    };
  }

  // String matching with escapes
  let string_match = text.match(/^\s*"(([^"]|\\")*[^\\]|)"/);
  if (string_match) {
    return {
      sub_value: string_match[1].replace(/\\/g, ''),
      resulting_text: text.slice(string_match[0].length),
    };
  }

  let match = text.match(/^\s*([A-Za-z]+) /)
  if (match) {
    let [matched_text, type] = match;
    let next_text = text.slice(matched_text.length);

    if (type === 'Array') {
      let [matched_text] = next_text.match(/^\s*\[/);

      let values = [];
      let inside_array = next_text.slice(matched_text.length);
      while (true) {
        let array_end_match = inside_array.match(/^\s*\]\s*/);
        if (array_end_match) {
          inside_array = inside_array.slice(array_end_match[0].length);
          break;
        }

        let { sub_value, resulting_text } = parse_value(inside_array);

        values.push(sub_value);

        let comma_match = resulting_text.match(/^\s*,/);
        if (comma_match) {
          resulting_text = resulting_text.slice(comma_match[0].length);
        }
        inside_array = resulting_text;
      }
      return {
        sub_value: values,
        resulting_text: inside_array,
      }
    } else if (type === 'Object') {
      let [matched_text] = next_text.match(/^\s*\{/);

      let values = {};
      let inside_array = next_text.slice(matched_text.length);
      while (true) {
        let array_end_match = inside_array.match(/^\s*\}\s*/);
        if (array_end_match) {
          inside_array = inside_array.slice(array_end_match[0].length);
          break;
        }

        // console.log(`inside_array:\n`, chalk.blue(inside_array));
        let { key, value, resulting_text } = parse_object_entry(inside_array);

        values[key] = value;

        let comma_match = resulting_text.match(/^\s*,/);
        if (comma_match) {
          resulting_text = resulting_text.slice(comma_match[0].length);
        }

        inside_array = resulting_text;
      }

      return {
        sub_value: values,
        resulting_text: inside_array,
      };
    } else {
      throw new Error(`Unknown type '${type}'`);
    }
  } else {
    console.log(`text:\n`, chalk.red(text));
    throw new Error(`Idk man, I couldn't match`);
  }
}

let parse = (text) => {
  let { sub_value, resulting_text } = parse_value(text);
  if (resulting_text !== '') {
    throw new Error(`Couldn't parse full text`);
  }
  return sub_value;
}

module.exports = { parse };

if (module.parent == null) {
  let example_text = `
  Array [
    Object {
      "at": 2018-01-01T10:00:00.000Z,
      "change": null,
      "collectionName": "@system@",
      "type": "start",
    },
    Object {
      "at": 2018-01-01T10:00:00.000Z,
      "change": Object {
        "path": "/jobs/match/try/offered",
        "value": Array [],
      },
      "collectionName": "firebase",
      "type": "set",
    },
    Object {
      "at": 2018-01-01T10:00:00.000Z,
      "change": Object {
        "path": "/jobs/match/try/offered/candidates/candidate_a",
        "value": "waiting-job",
      },
      "collectionName": "firebase",
      "type": "set",
    },
    Object {
      "at": 2018-01-01T10:00:00.000Z,
      "change": Object {
        "body": "SHIFT OFFER: Hi Michiel! You have been matched with a shift at Roche Brothers (Weston) for 1/1/2018 Today at 3:00 PM till Today at 9:00 PM at 41 Center St, Weston, MA 02493, USA. The total pay is approximately $90.00. NO parking available. Respond with \\"accept\\" or \\"decline\\". For more shift details goto the Jobletics App",
        "from": "+18572142093",
        "to": "+31622307457",
      },
      "collectionName": "twilio",
      "type": "insert",
    },
    Object {
      "at": 2018-01-01T10:04:00.000Z,
      "change": Object {
        "path": "/jobs/match/try/offered/candidates/candidate_a",
        "value": null,
      },
      "collectionName": "firebase",
      "type": "set",
    },
    Object {
      "at": 2018-01-01T10:04:00.000Z,
      "change": Object {
        "path": "/jobs/match/await/waiting-job",
        "value": null,
      },
      "collectionName": "firebase",
      "type": "set",
    },
    Object {
      "at": 2018-01-01T10:04:00.000Z,
      "change": Object {
        "path": "/jobs/match/try/offered/jobs/waiting-job",
        "value": null,
      },
      "collectionName": "firebase",
      "type": "set",
    },
    Object {
      "at": 2018-01-01T10:04:00.000Z,
      "change": Object {
        "path": "/jobs/items/waiting-job",
        "value": Object {
          "accepted": 1514801040000,
          "candidate": "candidate_a",
          "candidatedata": Object {
            "name": "Michiel Dral",
          },
          "empty_object": Object {},
          "status": "in_progress",
        },
      },
      "collectionName": "firebase",
      "type": "update",
    },
    Object {
      "at": 2018-01-01T10:04:00.000Z,
      "change": Object {
        "path": "/jobs/jobs_in_progress/waiting-job",
        "value": "candidate_a",
      },
      "collectionName": "firebase",
      "type": "set",
    },
    Object {
      "at": 2018-01-01T10:04:00.000Z,
      "change": Object {
        "path": "/users/profiles/candidate_a/jobs/waiting-job",
        "value": Object {
          "end": 1514858400000,
          "start": 1514836800000,
        },
      },
      "collectionName": "firebase",
      "type": "set",
    },
    Object {
      "at": 2018-01-01T10:04:00.000Z,
      "change": Object {
        "path": "/jobs/items/waiting-job/accepted_marker",
        "value": true,
      },
      "collectionName": "firebase",
      "type": "set",
    },
    Object {
      "at": 2018-01-01T10:04:00.000Z,
      "change": Object {
        "path": "/jobs/match/waiting_for_confirmation/waiting-job",
        "value": 1514836800000,
      },
      "collectionName": "firebase",
      "type": "set",
    },
  ]
  `
  console.log(`parse(example_text):`, parse(example_text))
}
