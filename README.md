# Dilly Dally

Dilly Dally is an agent friendly replacement for when2meet. 

First, we studied the experience that when2meet has. The first priority was copying this experience almost exactly for humans. Someone creates an event with a name. That takes you to the event page. There, you enter your name and optionally a password. You can then update your availability. You can come back later and enter your name again (and optionally password) to update your availability. The URL is persistent until the time of the event (max 3 months from the date of its creation). Once the event passes, the event and all associated data is deleted to free up space.

Dilly Dally is hosted on Cloudflare. No other infrastructure is required. Just Cloudflare products. It is almost a 1-click deploy.

The key differentiator for Dilly Dally is that agents can use it easily. It should be very simply for agents to create events via a curl request (they get an event ID and URL to show to their user). Then it should be super easy for agents to add availability for a particular name, and optionally supply a password. Do this in a sensible way such that the password is secure. A persistent markdown guide shows agents how to use Dilly Dally. An OpenAPI spec is provided, complete with JSON schemas, and the use of OpenAPI TypeScript. 

Rate limiting is also implemented to prevent abuse by rogue agents and script kiddies. 
