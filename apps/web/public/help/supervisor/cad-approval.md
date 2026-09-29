# CAD Approval Workflow

When **CAD write-back** is enabled **and** your agency requires supervisor approval before create/update:

1. Open the **CAD approval** queue.
2. Read the payload the dispatcher submitted (location, nature, comments, units as applicable).
3. Compare against the call / transcript context you can see.
4. **Approve** only when the payload matches the call and SOP.
5. **Reject** with a clear reason the dispatcher can correct.

## When the queue is empty

If CAD write-back is off (default / fail-closed), or approval is not required, the queue stays empty by design. Dispatchers still enter CAD in their native system.

Never invent an approval to "force" write-back. Write-back stays fail-closed until Agency Admin and KCPD/agency change-control enable it.
