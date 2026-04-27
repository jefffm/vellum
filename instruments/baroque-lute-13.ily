\version "2.24.0"

% 13-Course Baroque Lute (d-minor) — accord ordinaire
% Courses 1-6: fretted; Courses 7-13: diapasons (unfretted bass)

luteStringTunings = \stringTuning <f' d' a f d a,>

% Diapasons — default d-minor accord
% LilyPond additionalBassStrings: listed highest to lowest (7→13)
luteDiapasons = \stringTuning <g, f, ees, d, c, bes,, a,,>

luteTabFormat = #fret-letter-tablature-format
