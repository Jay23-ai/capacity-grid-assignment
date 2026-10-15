package main

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"os"
	"reflect"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestInvalidCapacityRanges(t *testing.T) {
	s := &server{}
	for _, query := range []string{"", "from=wrong&to=2026-01-05", "from=2026-02-30&to=2026-03-01", "from=2026-01-06&to=2026-01-05", "from=2020-01-01&to=2026-01-05"} {
		r := httptest.NewRequest("GET", "/api/capacity?"+query, nil)
		w := httptest.NewRecorder()
		s.handleCapacity(w, r)
		if w.Code != 400 {
			t.Errorf("%s: got %d", query, w.Code)
		}
	}
}

func TestInvalidWeeklyHours(t *testing.T) {
	s := &server{}
	for _, body := range []string{`{}`, `{"weeklyHours":null}`, `{"weeklyHours":-1}`, `{"weeklyHours":169}`, `{"weeklyHours":"40"}`, `{"weeklyHours":40,"extra":1}`, `{"weeklyHours":40} {}`, `{"weeklyHours":1e999}`} {
		r := httptest.NewRequest("PATCH", "/api/people/4", strings.NewReader(body))
		r.SetPathValue("id", "4")
		w := httptest.NewRecorder()
		s.handleUpdatePerson(w, r)
		if w.Code != 400 {
			t.Errorf("%s: got %d", body, w.Code)
		}
	}
}

// Run against the provided seed: TEST_DATABASE_URL=$DATABASE_URL go test ./...
func TestSeedCapacityAndSave(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL to run against the seeded database")
	}
	db, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	s := &server{db: db}
	read := func(from, to string) capacityResponse {
		t.Helper()
		w := httptest.NewRecorder()
		s.handleCapacity(w, httptest.NewRequest("GET", "/api/capacity?from="+from+"&to="+to, nil))
		if w.Code != 200 {
			t.Fatalf("capacity: %d %s", w.Code, w.Body.String())
		}
		var result capacityResponse
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		return result
	}
	result := read("2025-12-31", "2026-01-16")
	if len(result.People) != 500 || !reflect.DeepEqual(result.Weeks, []string{"2025-12-29", "2026-01-05", "2026-01-12"}) {
		t.Fatalf("unexpected dimensions: %d, %v", len(result.People), result.Weeks)
	}
	expected := [][]float64{{40, 0, 30}, {0, 32, 8}, {0, 4, 12}, {0, 45, 40}, {0, 20, 0}}
	for i, want := range expected {
		if !reflect.DeepEqual(result.People[i].Allocated, want) {
			t.Errorf("person %d: got %v, want %v", i+1, result.People[i].Allocated, want)
		}
	}
	// Restore only the value changed by this test, even when an assertion fails.
	original := result.People[3].WeeklyHours
	defer func() {
		if _, err := db.Exec(context.Background(), "UPDATE people SET weekly_hours=$1 WHERE id=4", original); err != nil {
			t.Errorf("restore: %v", err)
		}
	}()
	for _, value := range []string{"0", "47.5", "168"} {
		w := httptest.NewRecorder()
		r := httptest.NewRequest("PATCH", "/api/people/4", strings.NewReader(`{"weeklyHours":`+value+`}`))
		r.SetPathValue("id", "4")
		s.handleUpdatePerson(w, r)
		if w.Code != 200 {
			t.Fatalf("save: %d %s", w.Code, w.Body.String())
		}
		var saved struct {
			WeeklyHours float64 `json:"weeklyHours"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &saved); err != nil {
			t.Fatal(err)
		}
		updated := read("2025-12-29", "2026-01-16").People[3]
		if updated.WeeklyHours != saved.WeeklyHours || !reflect.DeepEqual(updated.Allocated, expected[3]) {
			t.Fatalf("incorrect state after save: %+v", updated)
		}
	}
	w := httptest.NewRecorder()
	r := httptest.NewRequest("PATCH", "/api/people/2147483647", strings.NewReader(`{"weeklyHours":40}`))
	r.SetPathValue("id", "2147483647")
	s.handleUpdatePerson(w, r)
	if w.Code != 404 {
		t.Fatalf("missing person: %d", w.Code)
	}
	empty := read("2030-01-01", "2030-01-06")
	for _, person := range empty.People {
		if person.Allocated[0] != 0 {
			t.Fatal("expected zero allocations outside seed")
		}
	}
}
