# CAD approval workflow

When CAD write-back is on **and** your agency requires approval:

1. Open the CAD approval queue.
2. Read the payload the dispatcher submitted.
3. Approve only if location, nature, and comments match the call.
4. Reject with a reason the dispatcher can fix.

If write-back is off, this queue is empty by design. Dispatchers still enter CAD themselves.
