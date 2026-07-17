\version "2.24.0"

% 13-Course Baroque Lute (d-minor) — accord ordinaire
% Courses 1-6: fretted; Courses 7-13: diapasons (unfretted bass)

luteStringTunings = \stringTuning <a, d f a d' f'>

% Diapasons — default d-minor accord
% LilyPond stringTuning input is written lowest to highest.  The resulting
% additional string numbers still run course 7 (G2) through course 13 (A1).
luteDiapasons = \stringTuning <a,, bes,, c, d, ees, f, g,>

#(define lute-diapason-labels
   #("a" "/a" "//a" "///a" "4" "5" "?"))

#(define (historical-lute-tablature-format context string-number fret-number)
   (if (and (> string-number 6) (<= string-number 13))
       (make-bold-markup
        (make-simple-markup
         (vector-ref lute-diapason-labels (- string-number 7))))
       (fret-letter-tablature-format context string-number fret-number)))

luteTabFormat = #historical-lute-tablature-format
