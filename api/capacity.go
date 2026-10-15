package main

import (
 "context"
 "net/http"
 "time"
)

type capacityPerson struct {
 ID int `json:"id"`
 Name string `json:"name"`
 WeeklyHours float64 `json:"weeklyHours"`
 Allocated []float64 `json:"allocated"`
}

type capacityResponse struct {
 Weeks []string `json:"weeks"`
 People []capacityPerson `json:"people"`
}

func monday(t time.Time) time.Time {
 return t.AddDate(0, 0, -(int(t.Weekday())+6)%7)
}

// Ranges cover whole Monday–Sunday weeks. Assignments include both endpoints;
// only Monday–Friday contributes hours. Keep zero-allocation people and weeks.
func (s *server) handleCapacity(w http.ResponseWriter, r *http.Request) {
 from, errFrom := time.Parse("2006-01-02", r.URL.Query().Get("from"))
 to, errTo := time.Parse("2006-01-02", r.URL.Query().Get("to"))
 if errFrom != nil || errTo != nil || from.After(to) || from.Year() < 1 || to.Year() > 9998 {
  http.Error(w, "Choose a valid start and end date (YYYY-MM-DD).", http.StatusBadRequest)
  return
 }
 from, to = monday(from), monday(to)
 if to.Sub(from) > 105*7*24*time.Hour {
  http.Error(w, "Choose a range of at most 106 weeks (about two years).", http.StatusBadRequest)
  return
 }
 ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
 defer cancel()
 rows, err := s.db.Query(ctx, `
 WITH weeks AS (
  SELECT generate_series($1::date, $2::date, interval '1 week')::date AS week
 ), totals AS (
  SELECT a.person_id, w.week,
   sum(a.hours_per_day * greatest(0,
    least(a.end_date, w.week + 4) - greatest(a.start_date, w.week) + 1)) AS allocated
  FROM assignments a
  JOIN weeks w ON a.start_date <= w.week + 4 AND a.end_date >= w.week
  WHERE a.start_date <= $2::date + 4 AND a.end_date >= $1::date
  GROUP BY a.person_id, w.week
 )
 SELECT p.id, p.name, p.weekly_hours::float8, w.week,
  coalesce(t.allocated, 0)::float8
 FROM people p CROSS JOIN weeks w
 LEFT JOIN totals t ON t.person_id = p.id AND t.week = w.week
 ORDER BY p.id, w.week`, from.Format("2006-01-02"), to.Format("2006-01-02"))
 if err != nil {
  http.Error(w, "Could not load capacity. Please try again.", http.StatusInternalServerError)
  return
 }
 defer rows.Close()
 result := capacityResponse{Weeks: []string{}, People: []capacityPerson{}}
 for week := from; !week.After(to); week = week.AddDate(0, 0, 7) {
  result.Weeks = append(result.Weeks, week.Format("2006-01-02"))
 }
 for rows.Next() {
  var p capacityPerson
  var week time.Time
  var allocated float64
  if err := rows.Scan(&p.ID, &p.Name, &p.WeeklyHours, &week, &allocated); err != nil {
   http.Error(w, "Could not read capacity.", http.StatusInternalServerError)
   return
  }
  if len(result.People) == 0 || result.People[len(result.People)-1].ID != p.ID {
   p.Allocated = []float64{}
   result.People = append(result.People, p)
  }
  last := &result.People[len(result.People)-1]
  last.Allocated = append(last.Allocated, allocated)
 }
 if rows.Err() != nil {
  http.Error(w, "Could not finish loading capacity. Please try again.", http.StatusInternalServerError)
  return
 }
 w.Header().Set("Cache-Control", "no-store")
 writeJSON(w, http.StatusOK, result)
}
