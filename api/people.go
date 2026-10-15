package main

import (
 "context"
 "encoding/json"
 "errors"
 "io"
 "math"
 "net/http"
 "strconv"
 "time"

 "github.com/jackc/pgx/v5"
)

func (s *server) handleUpdatePerson(w http.ResponseWriter, r *http.Request) {
 id, err := strconv.Atoi(r.PathValue("id"))
 if err != nil || id <= 0 {
  http.Error(w, "Invalid person ID.", http.StatusBadRequest)
  return
 }
 var input struct { WeeklyHours *float64 `json:"weeklyHours"` }
 decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
 decoder.DisallowUnknownFields()
 if err := decoder.Decode(&input); err != nil {
  http.Error(w, "Send a JSON object containing weeklyHours.", http.StatusBadRequest)
  return
 }
 if decoder.Decode(&struct{}{}) != io.EOF || input.WeeklyHours == nil || math.IsNaN(*input.WeeklyHours) || math.IsInf(*input.WeeklyHours, 0) || *input.WeeklyHours < 0 || *input.WeeklyHours > 168 {
  http.Error(w, "Weekly hours must be a number between 0 and 168.", http.StatusBadRequest)
  return
 }
 ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
 defer cancel()
 var person struct {
  ID int `json:"id"`
  WeeklyHours float64 `json:"weeklyHours"`
 }
 err = s.db.QueryRow(ctx, `UPDATE people SET weekly_hours = $1 WHERE id = $2 RETURNING id, weekly_hours::float8`, *input.WeeklyHours, id).Scan(&person.ID, &person.WeeklyHours)
 if errors.Is(err, pgx.ErrNoRows) {
  http.Error(w, "This person no longer exists.", http.StatusNotFound)
  return
 }
 if err != nil {
  http.Error(w, "Could not save weekly hours. Please try again.", http.StatusInternalServerError)
  return
 }
 writeJSON(w, http.StatusOK, person)
}
