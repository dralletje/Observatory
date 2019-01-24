#!/usr/bin/env node

let express = require('express');
let cors = require('cors');
let fs = require('mz/fs');
let chalk = require('chalk');
let glob = require('glob');
let path = require('path');
let socketio = require('socket.io');

let { parse: babel_parse } = require('@babel/parser');
let { parse: jest_parse } = require('./src/jest-parser');

let app = express();
var server = require('http').Server(app);
var io = socketio(server);

let root = process.argv[2] || '.';
let globroot = path.resolve(root);

io.on('connection', (socket) => {
  socket.on('ping', () => {
    console.log('Ping');
    socket.emit('pong');
  })
});

let glob_promise = async (pattern, options) => {
  return await new Promise((resolve, reject) => {
    glob(pattern, options, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result)
      }
    })
  })
}

let LIVE_SNAPSHOT_RESULTS = {};

app.use(express.static(__dirname + '/build'));

let get_snapshots_from_file = (content) => {
  let ast = babel_parse(content);

  let snapshots_array = ast.program.body.map((entry) => {
    let key = entry.expression.left.property.quasis[0].value.raw;
    let value = entry.expression.right.quasis[0].value.raw;
    let parsed = jest_parse(value);
    return { name: key, content: parsed };
  });

  return snapshots_array;
}

let api = {
  list_files: async (body) => {
    console.log(chalk.blue(`> Searching '**/*.snap' in '${globroot}'`));
    let files = await glob_promise("**/*.snap", {
      root: globroot,
      cwd: globroot,
      ignore: 'node_modules/**',
    });
    console.log(chalk.blue(`> Files found: ${files.join(', ')}`))
    return { files };
  },
  list_snapshots_in_file: async ({ file_path }) => {
    let real_path = path.join(globroot, file_path);
    let content = (await fs.readFile(real_path)).toString();

    let snapshots_array = get_snapshots_from_file(content);
    let snapshots = snapshots_array.map(x => x.name);

    return { snapshots };
  },
  retrieve_snapshot_content: async ({ file_path, snapshot_name }) => {
    let cache_key = `${file_path}:${snapshot_name}`;

    let real_path = path.join(globroot, file_path);
    let content = (await fs.readFile(real_path)).toString();

    let snapshots_array = get_snapshots_from_file(content);
    let snapshot = snapshots_array.find(x => x.name === snapshot_name);

    if (snapshot == null) {
      throw new Error(`Snapshot not found!`);
    } else {
      return { snapshot, live_result: LIVE_SNAPSHOT_RESULTS[cache_key] };
    }
  },
  live_test_result: ({ snapshot_path: absolute_path, snapshot_name, snapshot_data }) => {
    console.log(chalk.green(`> Received test results for '${snapshot_name}'`));

    let snapshot_path = path.relative(globroot, absolute_path);
    let key = `${snapshot_path}:${snapshot_name}`;
    LIVE_SNAPSHOT_RESULTS[key] = snapshot_data;

    io.emit('live_test_result', {
      snapshot_path: snapshot_path,
      snapshot_name: snapshot_name,
      snapshot_data: snapshot_data,
    });

    return { hey: 'hi' };
  },
};

app.post('/api', express.json(), async (req, res) => {
  try {
    let { method, data } = req.body;
    let api_fn = api[method];
    let result = await api_fn(data);
    res.send({
      success: true,
      data: result,
    });
  } catch (err) {
    res.send({
      success: false,
      message: err.message,
      stack: err.stack,
    });
  }
});

let port = process.env.PORT || 4000;
server.listen(port, () => {
  console.log(chalk.green(`> Server running on http://localhost:${port} 🚀`));
  console.log(chalk.green(`> Directory: ${globroot}`));
});
