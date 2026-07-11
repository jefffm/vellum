\version "2.24.0"

% 5-Course Baroque Guitar (French stringing, re-entrant)
% All courses fretted. Courses 4-5 are re-entrant.

% LilyPond's \stringTuning input runs from the lowest-numbered bass-side
% course to the highest course; it reverses that sequence for string numbers.
% Keep the fourth and fifth courses re-entrant at D4 and A3.
guitarStringTunings = \stringTuning <a d' g b e'>

guitarTabFormat = #fret-letter-tablature-format
