let request = require('supertest');
let { get_app } = require('../app.js');


it('should work', async () => {
  console.log('Cool');
  let app = get_app({ root: 'git-compare.fixture' });

  let result = await request(app)
    .post('/api')
    .send({
      method: 'retrieve_snapshot_content',
      data: { file_path: '__snapshots__/example-test.js.snap', snapshot_name: 'should match this snapshot 1' },
    });

  console.log(`result:`, result.body)
})
