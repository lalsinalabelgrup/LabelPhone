Stop making incremental visual adjustments.

The previous iterations have simply moved the clipping further down the screen.

The avatar is now correctly visible, but the Record button and End Call button have disappeared.

This indicates that the total vertical layout is still larger than the available content area.

Do NOT move another component before measuring the complete layout.

---

## NEW TASK

Treat this as a layout budget analysis.

Before changing any CSS:

Measure the actual rendered height of every major section.

Produce a report similar to:

Header

Avatar

Caller name

Call duration

Gap

Action grid

Gap

Record button block

Gap

End Call button

Bottom navigation

TOTAL CONTENT HEIGHT

AVAILABLE CONTENT HEIGHT

OVERFLOW

Only after identifying exactly where the extra height comes from should you modify the layout.

---

## IMPORTANT

Do not continue fixing individual elements.

The goal is to make the ENTIRE active-call screen fit.

Not simply move clipping from one control to another.

---

## LIKELY REQUIREMENT

If the available height cannot accommodate:

Avatar
Action grid
Record
End Call

then a responsive layout change is required.

For example:

Large layouts:

Record

End Call

Small embedded layouts:

Record End Call

on the SAME horizontal row.

However:

Do not implement this until you have confirmed that the layout budget actually requires it.

---

## VERIFY

Before reporting success, verify that ALL of the following are simultaneously visible:

Avatar

Caller name

Duration

Six action buttons

Record

End Call

Bottom navigation

If even one of these is clipped, the task is not complete.
