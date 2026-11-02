# 2-minute demo script

Before you start: cards warmed (`npm run warm`), an account created and signed in on your phone and laptop, speed set to Fast, one practice run done
(use Replay in the top bar to clear your predictions).

| Time | Do | Say |
|---|---|---|
| 0:00 | Sign in, open the demo match from Matches, press Start replay | "Cricket stops a lot. Amber markers in the scorebook are stoppages. Fans pick up their phones in those gaps." |
| 0:20 | Let a wicket card appear. Read the three blocks, tap a prediction | "What happened, why it matters, what to watch next, then one tap. The numbers come from the match; the AI explains them; code builds the question." |
| 0:45 | At a strategic timeout, switch Language (top right) to Hinglish and predict | "Same card in Hinglish. This break is simulated and labelled as such." |
| 1:05 | Resume play; show the points toast | "Scored by code after the next 6 balls, with a plain 'why'. The AI never touches scoring." |
| 1:20 | Reach a review card; show the explainer and poll | "It never guesses the decision. The consequences come from an authored table." |
| 1:40 | Stop the server, restart with `LLM_FORCE_FAIL=1`, show a card | "If the AI breaks, a template card still shows." |
| 1:50 | Open `evals/results.md` and the Predictions page | "Here is what I measured, including what failed, and what I would do next with real data." |

Presentation order: problem and evidence (with its limits), solution, demo, what you learned, next steps with real data.
