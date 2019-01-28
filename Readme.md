# Observatory

**A suite to do high-level testing, aka user testing, for developers.**

### The problem

When writing unit tests for my code, I find myself pain-stakingly writing out all the necessary data that goes in and checks for data that goes out. Even with jest snapshot matching, I still need to query or fech data I expect to be different after a test, instead of capturing all the changes that happened.

Even if all these tests work out, I still haven't tested them in tandem. Often systems use time as an input, and the progression of time has an impact on the result. Good luck testing that in your unit tests.

### The solution

A system that mimicks the real world, with progressing time and events being fired, while tracking all the side effects. After running the test, it will collect all these effects and match them to the stored snapshot.

Would be cool if there is a way to nicely view these events (jest snapshot aren't the most user friendly format).

### "Quick" start

Assuming you have a system you want to test, you will need a mock for all the external calls. Specifically, external calls that generate side-effects. I tend to mock everything in my tests anyway. For me the services I have to mock mostly include

- the database wrapper (sequelize, firebase, ...)
- http request library (node-fetch, axios, request, ...)
- External services (twilio, analytics, ...)

**Install dependencies**
```
npm install jest @observatory/jest @observatory/telescope
```

**Set up the mocks**  
Your mocks need to keep register the side effects, and you need to set this up, sorry. I normally but these in a `__mocks__` folder, so jest picks them up. My `axios` mock, for example, look like this:

```js
let Observatory = require("@observatory/jest");

// Register a name for the side-effect tracker
let axios_journal = Observatory.Journal("axios");
module.exports = {
  get: async (url) => {
    // Track side-effect
    axios_journal.push({ url });

    // Return value based on the url
    // TODO You have to fill this in yourself
  },
};
```

**Write a test**
```js
let Observatory = require("@observatory/jest");

it(
  "should do the fetch request 10 minutes after incoming request",
  // Call Observatory.test with a generator function as argument
  Observatory.test(function*() {
    // TODO Initialize your mock database and start the services
    // For now I'm just going to put some code I want to test right here

    // Show this title in the output results, makes it a lot easier to keep the test managable if your tests get bigger
    Observatory.marker({ title: "Starting timeout service" });

    // This would normally be inside a different file that you want to test
    let axios = require('axios');
    let has_ran_timer = false;
    // Do a request after ten minutes
    setTimeout(() => {
      // Dates work as you'd expect, `Date.now()` will return a fake, test date.
      // Also, even though we do not `await` this inside the test,
      // `Observatory.Forward_Time` will make sure these all are resolved
      await axios.get(`https://service.com/side-effect/${Date.now()}`);
      has_ran_timer = true;
    }, 10 * 60 * 1000);

    // `yield` can be used here just like `await`,servatory
    // but in this case it is used to signal time progression to observatory
    // So here we are advancing time for 20 minutes
    yield Observatory.Forward_Time(20 * 60 * 1000);

    // ... Normally your test would contain more events (that would in the real world would be triggered by a user) or time progressions

    // Just make assertions like you'd normally do, and optionally use `Observatory.match_observations()`
    expect(has_ran_timer).toEqual(true);
    // uses `expect(...).toMatchSnapshot()` internally on all the events collected in the log.
    Observatory.match_observations();
  })
);
```

**Run telescope to view results**  
As soon as you have a snapshot, run `./node_modules/.bin/telescope`. Browse to `http://localhost:4000` and you will see a list of found snapshots. Select a snapshot, and when you re-run jest and the result changes, this will be updated in the telescope tab


### Faq
**Does this work only with jest, or can I use my favorite test framework**  
Well if jest is not your favorite test framework, I don't know ;)  
In all seriousness: no.  
I only made a version that works with jest for now, as it kind of requires the snapshot matcher. Might expand into other testing frameworks when people want that.
