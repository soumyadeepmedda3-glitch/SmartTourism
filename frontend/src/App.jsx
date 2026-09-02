import { useEffect, useMemo, useState } from "react";
import "./App.css";
import TourismMap from "./TourismMap";

const API_URL = "http://localhost:5000";

const INTERESTS = [
  "Nature",
  "Adventure",
  "Food",
  "Culture",
  "History",
  "Shopping",
  "All",
];

const TRAVEL_MODES = [
  {
    value: "cab",
    label: "🚕 Cab",
    description: "Comfortable private cab",
  },
  {
    value: "own_car",
    label: "🚗 Own Car",
    description: "Calculate fuel cost",
  },
  {
    value: "public_transport",
    label: "🚌 Public Transport",
    description: "Approximate public transport",
  },
  {
    value: "walking",
    label: "🚶 Walking",
    description: "For short local distances",
  },
];

function money(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return "₹0";
  }

  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function hasPrice(value) {
  return (
    value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value))
  );
}

function getPlaceKey(place) {
  return (
    place?.id ||
    `${place?.name}-${place?.latitude}-${place?.longitude}`
  );
}

function getHotelKey(hotel) {
  return (
    hotel?.id ||
    `${hotel?.name}-${hotel?.latitude}-${hotel?.longitude}`
  );
}

/* =========================================================
   TRAVEL MODE LABEL
========================================================= */

function getTravelModeLabel(mode) {
  switch (mode) {
    case "own_car":
      return "Own Car";

    case "public_transport":
      return "Public Transport";

    case "walking":
      return "Walking";

    case "cab":
    default:
      return "Cab";
  }
}

/* =========================================================
   DURATION FORMAT
========================================================= */

function formatDuration(minutes) {
  const value = Number(minutes);

  if (!Number.isFinite(value) || value <= 0) {
    return "Route time unavailable";
  }

  const totalMinutes = Math.round(value);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours > 0 && mins > 0) {
    return `${hours} hr ${mins} min`;
  }

  if (hours > 0) {
    return `${hours} hr`;
  }

  return `${mins} min`;
}

function App() {
  const [destination, setDestination] = useState("");

  const [days, setDays] = useState("3");
  const [customDays, setCustomDays] = useState("6");

  const [travellers, setTravellers] = useState("1");
  const [customTravellers, setCustomTravellers] =
    useState("6");

  const [budget, setBudget] = useState("");

  const [interest, setInterest] =
    useState("Nature");

  const [travelMode, setTravelMode] =
    useState("cab");

  const [currentLocation, setCurrentLocation] =
    useState(null);

  const [locationName, setLocationName] =
    useState("");

  const [locationLoading, setLocationLoading] =
    useState(false);

  const [locationError, setLocationError] =
    useState("");

  const [trip, setTrip] = useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] = useState("");

  const [activeDay, setActiveDay] =
    useState(1);

  /* =====================================================
     CUSTOM VALUES
  ===================================================== */

  const effectiveDays =
    days === "custom"
      ? Number(customDays)
      : Number(days);

  const effectiveTravellers =
    travellers === "custom"
      ? Number(customTravellers)
      : Number(travellers);

  /* =====================================================
     CURRENT LOCATION
  ===================================================== */

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(
        "Your browser does not support location."
      );
      return;
    }

    setLocationLoading(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude =
          position.coords.latitude;

        const longitude =
          position.coords.longitude;

        const location = {
          latitude,
          longitude,
          displayName: "Current Location",
        };

        setCurrentLocation(location);

        try {
          const response =
            await fetch(
              `${API_URL}/api/destination/search?destination=${encodeURIComponent(
                `${latitude},${longitude}`
              )}`
            );

          if (response.ok) {
            const data =
              await response.json();

            setLocationName(
              data?.location?.displayName ||
                "Current Location"
            );
          } else {
            setLocationName(
              "Current Location"
            );
          }
        } catch {
          setLocationName(
            "Current Location"
          );
        }

        setLocationLoading(false);
      },

      (err) => {
        console.error(
          "Location error:",
          err
        );

        setLocationLoading(false);

        if (err.code === 1) {
          setLocationError(
            "Location permission denied. Please allow location access."
          );
        } else if (err.code === 2) {
          setLocationError(
            "Your current location could not be detected."
          );
        } else {
          setLocationError(
            "Location request timed out. Please try again."
          );
        }
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  };

  useEffect(() => {
    detectLocation();
  }, []);

  /* =====================================================
     GENERATE TRIP
  ===================================================== */

  const handleGenerate = async (e) => {
    e.preventDefault();

    setError("");
    setTrip(null);
    setActiveDay(1);

    if (!destination.trim()) {
      setError(
        "Please enter your destination."
      );
      return;
    }

    if (
      !budget ||
      Number(budget) <= 0
    ) {
      setError(
        "Please enter a valid total budget."
      );
      return;
    }

    if (
      !Number.isFinite(effectiveDays) ||
      effectiveDays < 1 ||
      effectiveDays > 365
    ) {
      setError(
        "Days must be between 1 and 365."
      );
      return;
    }

    if (
      !Number.isFinite(
        effectiveTravellers
      ) ||
      effectiveTravellers < 1 ||
      effectiveTravellers > 100
    ) {
      setError(
        "Travellers must be between 1 and 100."
      );
      return;
    }

    try {
      setLoading(true);

      const payload = {
        destination:
          destination.trim(),

        days: effectiveDays,

        budget: Number(budget),

        travellers:
          effectiveTravellers,

        interest,

        travelMode,

        currentLocation:
          currentLocation
            ? {
                latitude:
                  currentLocation.latitude,

                longitude:
                  currentLocation.longitude,

                displayName:
                  locationName ||
                  "Current Location",
              }
            : null,
      };

      console.log(
        "Sending trip request:",
        payload
      );

      const response =
        await fetch(
          `${API_URL}/api/trip`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(payload),
          }
        );

      let data;

      try {
        data =
          await response.json();
      } catch {
        throw new Error(
          "Backend returned an invalid response. Check server.js."
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Trip generation failed."
        );
      }

      console.log(
        "Generated SmartTourism response:",
        data
      );

      /* =================================================
         IMPORTANT FIX

         Backend may return:

         {
           success: true,
           trip: {...}
         }

         OR directly:

         {
           destination: "...",
           days: 3,
           ...
         }

         Support BOTH.
      ================================================= */

      const rawTrip =
        data?.trip || data;

      /* =================================================
         NORMALIZE BACKEND DATA
      ================================================= */

      const normalizedTrip = {
        ...rawTrip,

        destination:
          typeof rawTrip?.destination ===
          "string"
            ? rawTrip.destination
            : rawTrip?.destination?.name ||
              rawTrip?.destination?.displayName ||
              destination.trim(),

        days:
          Number(rawTrip?.days) > 0
            ? Number(rawTrip.days)
            : effectiveDays,

        budget:
          Number(rawTrip?.budget) > 0
            ? Number(rawTrip.budget)
            : Number(budget),

        travellers:
          Number(rawTrip?.travellers) > 0
            ? Number(rawTrip.travellers)
            : effectiveTravellers,

        interest:
          rawTrip?.interest ||
          interest,

        travelMode:
          rawTrip?.travelMode ||
          travelMode,

        currentLocation:
          rawTrip?.currentLocation ||
          currentLocation,

        destinationLocation:
          rawTrip?.destinationLocation ||
          null,

        /* =================================================
           CURRENT LOCATION → DESTINATION

           Support both backend names.
        ================================================= */

        currentToDestination:
          rawTrip?.currentToDestination ||
          rawTrip?.interCityRoute ||
          null,

        recommendedPlaces:
          Array.isArray(
            rawTrip?.recommendedPlaces
          )
            ? rawTrip.recommendedPlaces
            : [],

        allPlaces:
          Array.isArray(
            rawTrip?.allPlaces
          )
            ? rawTrip.allPlaces
            : Array.isArray(
                rawTrip?.recommendedPlaces
              )
            ? rawTrip.recommendedPlaces
            : [],

        recommendedHotels:
          Array.isArray(
            rawTrip?.recommendedHotels
          )
            ? rawTrip.recommendedHotels
            : [],

        affordableHotels:
          Array.isArray(
            rawTrip?.affordableHotels
          )
            ? rawTrip.affordableHotels
            : [],

        dayWisePlan:
          Array.isArray(
            rawTrip?.dayWisePlan
          )
            ? rawTrip.dayWisePlan
            : [],

        aiRecommendations:
          rawTrip?.aiRecommendations ||
          {},

        budgetSummary:
          rawTrip?.budgetSummary ||
          {},
      };

      console.log(
        "Normalized SmartTourism trip:",
        normalizedTrip
      );

      setTrip(normalizedTrip);

      setTimeout(() => {
        document
          .getElementById(
            "trip-result"
          )
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 150);
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to connect to SmartTourism backend."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     TRIP DATA
  ===================================================== */

  const recommendedPlaces =
    Array.isArray(
      trip?.recommendedPlaces
    )
      ? trip.recommendedPlaces
      : [];

  const allPlaces =
    Array.isArray(trip?.allPlaces)
      ? trip.allPlaces
      : recommendedPlaces;

  const recommendedHotels =
    Array.isArray(
      trip?.recommendedHotels
    )
      ? trip.recommendedHotels
      : [];

  const affordableHotels =
    Array.isArray(
      trip?.affordableHotels
    )
      ? trip.affordableHotels
      : [];

  const selectedBudgetHotel =
    trip?.selectedBudgetHotel ||
    affordableHotels[0] ||
    null;

  const dayWisePlan =
    Array.isArray(
      trip?.dayWisePlan
    )
      ? trip.dayWisePlan
      : [];

  const budgetSummary =
    trip?.budgetSummary || {};

  const aiRecommendations =
    trip?.aiRecommendations || {};

  /* =====================================================
     CURRENT → DESTINATION

     Support both field names.
  ===================================================== */

  const currentToDestination =
    trip?.currentToDestination ||
    trip?.interCityRoute ||
    null;

  /* =====================================================
     ACTIVE DAY
  ===================================================== */

  const activeDayPlan =
    dayWisePlan.find(
      (day) =>
        Number(day.day) ===
        Number(activeDay)
    ) || null;

  /* =====================================================
     TOTAL COSTS
  ===================================================== */

  const totalBudget =
    Number(
      trip?.budget || budget
    ) || 0;

  const estimatedTripCost =
    Number(
      budgetSummary.estimatedTripCost
    ) || 0;

  const remainingBudget =
    Number(
      budgetSummary.remainingBudget
    ) || 0;

  const budgetExceeded =
    estimatedTripCost >
    totalBudget;

  /* =====================================================
     COST BREAKDOWN

     Use nullish checks instead of || where
     appropriate so real 0 values remain 0.
  ===================================================== */

  const costItems = useMemo(
    () => [
      {
        icon: "🏨",
        label: "Hotel",
        value:
          Number(
            budgetSummary.hotelCost ??
              budgetSummary.hotelEstimate ??
              0
          ) || 0,
      },

      {
        icon: "🎟️",
        label: "Entry fees",
        value:
          Number(
            budgetSummary.entryCost ??
              budgetSummary.entryFees ??
              0
          ) || 0,
      },

      {
        icon: "🛣️",
        label: "Travel to destination",
        value:
          Number(
            budgetSummary.destinationTransportCost ??
              budgetSummary.outboundTransport ??
              0
          ) || 0,
      },

      {
        icon: "🚕",
        label: "Local transport",
        value:
          Number(
            budgetSummary.localTransportCost ??
              budgetSummary.localTransport ??
              0
          ) || 0,
      },

      {
        icon: "🍛",
        label: "Food",
        value:
          Number(
            budgetSummary.foodCost ??
              budgetSummary.food ??
              0
          ) || 0,
      },
    ],
    [budgetSummary]
  );

  /* =====================================================
     MAP DATA
  ===================================================== */

  const mapPlaces =
    allPlaces.filter(
      (place) =>
        Number.isFinite(
          Number(place.latitude)
        ) &&
        Number.isFinite(
          Number(place.longitude)
        )
    );

  const mapHotels =
    recommendedHotels.filter(
      (hotel) =>
        Number.isFinite(
          Number(hotel.latitude)
        ) &&
        Number.isFinite(
          Number(hotel.longitude)
        )
    );

  /* =====================================================
     MAP CARD FOCUS
  ===================================================== */

  const focusPlace = (place) => {
    window.dispatchEvent(
      new CustomEvent(
        "focusPlace",
        {
          detail: place,
        }
      )
    );

    document
      .querySelector(
        ".tourism-map-section"
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
  };

  const focusHotel = (hotel) => {
    window.dispatchEvent(
      new CustomEvent(
        "focusHotel",
        {
          detail: hotel,
        }
      )
    );

    document
      .querySelector(
        ".tourism-map-section"
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
  };

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <>
      <div className="app">

        {/* =================================================
            NAVBAR
        ================================================= */}

        <nav className="navbar">

          <div className="logo">
            <span>✦</span>
            SmartTourism
          </div>

          <div className="nav-links">

            <a href="#home">
              Home
            </a>

            <a href="#features">
              Features
            </a>

            <a href="#about">
              About
            </a>

          </div>

          <button
            className="nav-button"
            onClick={() =>
              document
                .getElementById(
                  "planner"
                )
                ?.scrollIntoView({
                  behavior:
                    "smooth",
                })
            }
          >
            Plan a Trip
          </button>

        </nav>

        {/* =================================================
            HERO
        ================================================= */}

        <main
          id="home"
          className="hero"
        >

          <div className="hero-content">

            <div className="badge">
              ✨ AI-Powered Travel
              Planning
            </div>

            <h1>
              Your journey.
              <br />

              <span>
                Planned smarter.
              </span>
            </h1>

            <p>
              SmartTourism combines
              real-world map data,
              your budget, current
              location and AI to
              build a practical trip.
            </p>

            <div className="hero-stats">

              <div>
                <strong>
                  AI
                </strong>

                <span>
                  Smart Planning
                </span>
              </div>

              <div>
                <strong>
                  ₹
                </strong>

                <span>
                  Budget First
                </span>
              </div>

              <div>
                <strong>
                  GPS
                </strong>

                <span>
                  Route Aware
                </span>
              </div>

            </div>

          </div>

          {/* =================================================
              PLANNER
          ================================================= */}

          <div
            className="planner-card"
            id="planner"
          >

            <div className="planner-header">

              <div>

                <p className="small-label">
                  AI TRAVEL PLANNER
                </p>

                <h2>
                  Build your
                  perfect trip
                </h2>

              </div>

              <div className="ai-icon">
                ✦
              </div>

            </div>

            <form
              onSubmit={
                handleGenerate
              }
            >

              {/* DESTINATION */}

              <div className="form-group">

                <label>
                  📍 Where do you
                  want to go?
                </label>

                <input
                  type="text"
                  value={
                    destination
                  }
                  onChange={(e) =>
                    setDestination(
                      e.target.value
                    )
                  }
                  placeholder="e.g. Darjeeling"
                />

              </div>

              {/* CURRENT LOCATION */}

              <div className="form-group">

                <label>
                  🧭 Starting from
                </label>

                <div
                  style={{
                    display:
                      "flex",
                    gap: "8px",
                  }}
                >

                  <div
                    style={{
                      flex: 1,
                      padding:
                        "12px 14px",
                      border:
                        "1px solid #dfe5df",
                      borderRadius:
                        "10px",
                      background:
                        "#f7faf7",
                      color:
                        "#526058",
                      fontSize:
                        "14px",
                    }}
                  >
                    {locationLoading
                      ? "Detecting your location..."
                      : locationName ||
                        "Current location not detected"}
                  </div>

                  <button
                    type="button"
                    onClick={
                      detectLocation
                    }
                    disabled={
                      locationLoading
                    }
                    style={{
                      border:
                        "none",
                      borderRadius:
                        "10px",
                      padding:
                        "0 14px",
                      background:
                        "#17221d",
                      color:
                        "white",
                      cursor:
                        "pointer",
                      fontWeight:
                        "600",
                    }}
                  >
                    {locationLoading
                      ? "..."
                      : "📍"}
                  </button>

                </div>

                {locationError && (
                  <small
                    style={{
                      color:
                        "#a33a3a",
                      display:
                        "block",
                      marginTop:
                        "7px",
                    }}
                  >
                    ⚠️{" "}
                    {
                      locationError
                    }
                  </small>
                )}

              </div>

              {/* DAYS + TRAVELLERS */}

              <div className="form-row">

                <div className="form-group">

                  <label>
                    📅 Days
                  </label>

                  <select
                    value={days}
                    onChange={(e) =>
                      setDays(
                        e.target.value
                      )
                    }
                  >

                    <option value="1">
                      1 Day
                    </option>

                    <option value="2">
                      2 Days
                    </option>

                    <option value="3">
                      3 Days
                    </option>

                    <option value="4">
                      4 Days
                    </option>

                    <option value="5">
                      5 Days
                    </option>

                    <option value="7">
                      7 Days
                    </option>

                    <option value="14">
                      14 Days
                    </option>

                    <option value="30">
                      30 Days
                    </option>

                    <option value="custom">
                      Custom
                    </option>

                  </select>

                  {days ===
                    "custom" && (
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={
                        customDays
                      }
                      onChange={(e) =>
                        setCustomDays(
                          e.target.value
                        )
                      }
                      placeholder="Number of days"
                      style={{
                        marginTop:
                          "8px",
                      }}
                    />
                  )}

                </div>

                <div className="form-group">

                  <label>
                    👥 Travellers
                  </label>

                  <select
                    value={
                      travellers
                    }
                    onChange={(e) =>
                      setTravellers(
                        e.target.value
                      )
                    }
                  >

                    <option value="1">
                      1 Traveller
                    </option>

                    <option value="2">
                      2 Travellers
                    </option>

                    <option value="3">
                      3 Travellers
                    </option>

                    <option value="4">
                      4 Travellers
                    </option>

                    <option value="5">
                      5 Travellers
                    </option>

                    <option value="10">
                      10 Travellers
                    </option>

                    <option value="20">
                      20 Travellers
                    </option>

                    <option value="custom">
                      Custom
                    </option>

                  </select>

                  {travellers ===
                    "custom" && (
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={
                        customTravellers
                      }
                      onChange={(e) =>
                        setCustomTravellers(
                          e.target.value
                        )
                      }
                      placeholder="Number of travellers"
                      style={{
                        marginTop:
                          "8px",
                      }}
                    />
                  )}

                </div>

              </div>

              {/* BUDGET */}

              <div className="form-group">

                <label>
                  💰 Total Trip Budget
                </label>

                <input
                  type="number"
                  min="1"
                  value={budget}
                  onChange={(e) =>
                    setBudget(
                      e.target.value
                    )
                  }
                  placeholder="e.g. ₹15000"
                />

                <small
                  style={{
                    display:
                      "block",
                    marginTop:
                      "6px",
                    color:
                      "#68756d",
                  }}
                >
                  The AI will
                  prioritize this
                  budget while
                  selecting hotels,
                  transport and
                  activities.
                </small>

              </div>

              {/* TRAVEL MODE */}

              <div className="form-group">

                <label>
                  🚗 How will you
                  travel?
                </label>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: "8px",
                    marginTop:
                      "8px",
                  }}
                >

                  {TRAVEL_MODES.map(
                    (mode) => (
                      <button
                        key={
                          mode.value
                        }
                        type="button"
                        onClick={() =>
                          setTravelMode(
                            mode.value
                          )
                        }
                        style={{
                          border:
                            travelMode ===
                            mode.value
                              ? "2px solid #17221d"
                              : "1px solid #dfe5df",

                          borderRadius:
                            "10px",

                          padding:
                            "11px",

                          background:
                            travelMode ===
                            mode.value
                              ? "#eef4ef"
                              : "white",

                          cursor:
                            "pointer",

                          textAlign:
                            "left",
                        }}
                      >

                        <strong
                          style={{
                            display:
                              "block",
                            color:
                              "#17221d",
                          }}
                        >
                          {
                            mode.label
                          }
                        </strong>

                        <small
                          style={{
                            display:
                              "block",
                            marginTop:
                              "4px",
                            color:
                              "#68756d",
                          }}
                        >
                          {
                            mode.description
                          }
                        </small>

                      </button>
                    )
                  )}

                </div>

              </div>

              {/* INTEREST */}

              <div className="form-group">

                <label>
                  ❤️ What do you
                  enjoy?
                </label>

                <div className="interest-grid">

                  {INTERESTS.map(
                    (item) => (
                      <button
                        key={item}
                        type="button"
                        className={
                          interest ===
                          item
                            ? "interest active"
                            : "interest"
                        }
                        onClick={() =>
                          setInterest(
                            item
                          )
                        }
                      >
                        {item}
                      </button>
                    )
                  )}

                </div>

              </div>

              {/* ERROR */}

              {error && (
                <div className="error-message">
                  ⚠️ {error}
                </div>
              )}

              {/* GENERATE */}

              <button
                type="submit"
                className="generate-button"
                disabled={loading}
              >
                {loading
                  ? "🤖 AI is planning your trip..."
                  : "Generate Smart Trip"}

                {!loading && (
                  <span>
                    →
                  </span>
                )}

              </button>

            </form>

          </div>

        </main>

        {/* =================================================
            LOADING
        ================================================= */}

        {loading && (
          <section
            style={{
              maxWidth:
                "1100px",
              margin:
                "30px auto",
              padding:
                "30px",
              textAlign:
                "center",
            }}
          >

            <div
              style={{
                fontSize:
                  "38px",
                marginBottom:
                  "12px",
              }}
            >
              ✦
            </div>

            <h3
              style={{
                fontFamily:
                  "Syne, sans-serif",
              }}
            >
              AI is building
              your journey
            </h3>

            <p
              style={{
                color:
                  "#68756d",
              }}
            >
              Checking routes,
              real places,
              hotels, transport
              and your budget...
            </p>

          </section>
        )}

        {/* =================================================
            TRIP RESULT
        ================================================= */}

        {trip && !loading && (
          <section
            id="trip-result"
            className="trip-result"
          >

            {/* HEADER */}

            <div className="result-heading">

              <p className="small-label">
                AI GENERATED TRIP
              </p>

              <h2>
                {trip.destination}
              </h2>

              <p>
                {aiRecommendations.summary ||
                  `Your ${trip.days}-day trip has been optimized around your budget.`}
              </p>

            </div>

            {/* SUMMARY */}

            <div className="trip-summary">

              <div>
                <strong>
                  {trip.days}
                </strong>

                <span>
                  Days
                </span>
              </div>

              <div>
                <strong>
                  {money(
                    trip.budget
                  )}
                </strong>

                <span>
                  Total Budget
                </span>
              </div>

              <div>
                <strong>
                  {trip.travellers}
                </strong>

                <span>
                  Travellers
                </span>
              </div>

              <div>
                <strong>
                  {trip.interest}
                </strong>

                <span>
                  Interest
                </span>
              </div>

            </div>

            {/* =================================================
                JOURNEY DISTANCE
            ================================================= */}

            {currentToDestination && (
              <div
                className="result-section"
                style={{
                  marginBottom:
                    "24px",
                }}
              >

                <div className="result-section-header">

                  <div>

                    <p className="small-label">
                      YOUR JOURNEY
                    </p>

                    <h3>
                      Current location →
                      {" "}
                      {trip.destination}
                    </h3>

                  </div>

                  <span className="result-count">
                    {getTravelModeLabel(
                      trip.travelMode
                    )}
                  </span>

                </div>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "12px",
                  }}
                >

                  <div
                    style={{
                      padding:
                        "18px",
                      background:
                        "#f5f8f5",
                      borderRadius:
                        "14px",
                    }}
                  >

                    <small>
                      📏 Road distance
                    </small>

                    <strong
                      style={{
                        display:
                          "block",
                        marginTop:
                          "5px",
                        fontSize:
                          "22px",
                      }}
                    >
                      {Number(
                        currentToDestination
                          .distanceKm || 0
                      ).toLocaleString(
                        "en-IN"
                      )}{" "}
                      km
                    </strong>

                  </div>

                  <div
                    style={{
                      padding:
                        "18px",
                      background:
                        "#f5f8f5",
                      borderRadius:
                        "14px",
                    }}
                  >

                    <small>
                      ⏱️ Estimated travel time
                    </small>

                    <strong
                      style={{
                        display:
                          "block",
                        marginTop:
                          "5px",
                        fontSize:
                          "22px",
                      }}
                    >
                      {formatDuration(
                        currentToDestination
                          .durationMinutes
                      )}
                    </strong>

                  </div>

                  <div
                    style={{
                      padding:
                        "18px",
                      background:
                        "#fff8f3",
                      borderRadius:
                        "14px",
                    }}
                  >

                    <small>
                      🚗 Travel mode
                    </small>

                    <strong
                      style={{
                        display:
                          "block",
                        marginTop:
                          "5px",
                        fontSize:
                          "18px",
                      }}
                    >
                      {getTravelModeLabel(
                        trip.travelMode
                      )}
                    </strong>

                  </div>

                </div>

              </div>
            )}

            {/* =================================================
                BUDGET
            ================================================= */}

            <div
              className="result-section"
              style={{
                marginBottom:
                  "28px",
              }}
            >

              <div
                style={{
                  padding:
                    "24px",
                  borderRadius:
                    "18px",
                  background:
                    budgetExceeded
                      ? "#fff5f5"
                      : "#eef7f0",
                  border:
                    budgetExceeded
                      ? "1px solid #f0caca"
                      : "1px solid #cfe2d3",
                }}
              >

                <div className="result-section-header">

                  <div>

                    <p className="small-label">
                      BUDGET FIRST
                    </p>

                    <h3>
                      Estimated total cost
                    </h3>

                    <small
                      style={{
                        color:
                          "#68756d",
                      }}
                    >
                      Real available
                      prices are used
                      where available.
                      Unknown costs are
                      approximate.
                    </small>

                  </div>

                  <strong
                    style={{
                      fontSize:
                        "28px",
                      color:
                        budgetExceeded
                          ? "#a33a3a"
                          : "#315c3b",
                    }}
                  >
                    {money(
                      estimatedTripCost
                    )}
                  </strong>

                </div>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "10px",
                  }}
                >

                  {costItems.map(
                    (item) => (
                      <div
                        key={
                          item.label
                        }
                        style={{
                          padding:
                            "15px",
                          background:
                            "white",
                          borderRadius:
                            "12px",
                        }}
                      >

                        <small>
                          {
                            item.icon
                          }{" "}
                          {
                            item.label
                          }
                        </small>

                        <strong
                          style={{
                            display:
                              "block",
                            marginTop:
                              "5px",
                          }}
                        >
                          {money(
                            item.value
                          )}
                        </strong>

                      </div>
                    )
                  )}

                </div>

                <div
                  style={{
                    marginTop:
                      "14px",
                    padding:
                      "15px",
                    background:
                      "white",
                    borderRadius:
                      "12px",
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    gap: "10px",
                    flexWrap:
                      "wrap",
                  }}
                >

                  <strong>
                    {budgetExceeded
                      ? "⚠️ Budget shortfall"
                      : "✅ Remaining budget"}
                  </strong>

                  <strong
                    style={{
                      color:
                        budgetExceeded
                          ? "#a33a3a"
                          : "#315c3b",
                    }}
                  >
                    {money(
                      Math.abs(
                        remainingBudget
                      )
                    )}
                  </strong>

                </div>

                {aiRecommendations.budgetAdvice && (
                  <p
                    style={{
                      margin:
                        "14px 0 0",
                      color:
                        "#526058",
                      lineHeight:
                        "1.6",
                    }}
                  >
                    💡{" "}
                    {
                      aiRecommendations.budgetAdvice
                    }
                  </p>
                )}

              </div>

            </div>

            {/* =================================================
                DAY-WISE PLAN
            ================================================= */}

            <div className="result-section">

              <div className="result-section-header">

                <div>

                  <p className="small-label">
                    SMART ITINERARY
                  </p>

                  <h3>
                    Your day-by-day route
                  </h3>

                </div>

                <span className="result-count">
                  {dayWisePlan.length} days
                </span>

              </div>

              {/* DAY BUTTONS */}

              <div
                style={{
                  display:
                    "flex",
                  gap: "8px",
                  flexWrap:
                    "wrap",
                  marginBottom:
                    "18px",
                }}
              >

                {dayWisePlan.map(
                  (day) => (
                    <button
                      key={
                        day.day
                      }
                      type="button"
                      onClick={() =>
                        setActiveDay(
                          Number(
                            day.day
                          )
                        )
                      }
                      style={{
                        border:
                          activeDay ===
                          Number(
                            day.day
                          )
                            ? "2px solid #17221d"
                            : "1px solid #dfe5df",

                        background:
                          activeDay ===
                          Number(
                            day.day
                          )
                            ? "#17221d"
                            : "white",

                        color:
                          activeDay ===
                          Number(
                            day.day
                          )
                            ? "white"
                            : "#17221d",

                        padding:
                          "9px 14px",

                        borderRadius:
                          "10px",

                        cursor:
                          "pointer",

                        fontWeight:
                          "600",
                      }}
                    >
                      Day{" "}
                      {day.day}
                    </button>
                  )
                )}

              </div>

              {/* ACTIVE DAY */}

              {activeDayPlan && (
                <div
                  style={{
                    padding:
                      "22px",
                    background:
                      "#f5f8f5",
                    borderRadius:
                      "18px",
                  }}
                >

                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "center",
                      gap:
                        "12px",
                      flexWrap:
                        "wrap",
                    }}
                  >

                    <div>

                      <p className="small-label">
                        DAY{" "}
                        {
                          activeDayPlan.day
                        }
                      </p>

                      <h3
                        style={{
                          margin:
                            "0",
                        }}
                      >
                        {activeDayPlan
                          .places
                          ?.length
                          ? `Explore ${trip.destination}`
                          : "Flexible day"}
                      </h3>

                    </div>

                    {activeDayPlan.route && (
                      <div
                        style={{
                          textAlign:
                            "right",
                        }}
                      >

                        <strong>
                          {
                            activeDayPlan
                              .route
                              .distanceKm
                          }{" "}
                          km
                        </strong>

                        <small
                          style={{
                            display:
                              "block",
                            color:
                              "#68756d",
                          }}
                        >
                          {
                            activeDayPlan
                              .route
                              .durationMinutes
                          }{" "}
                          min{" "}
                          {getTravelModeLabel(
                            trip.travelMode
                          ).toLowerCase()}
                        </small>

                      </div>
                    )}

                  </div>

                  {activeDayPlan.reason && (
                    <p
                      style={{
                        color:
                          "#68756d",
                        lineHeight:
                          "1.6",
                      }}
                    >
                      {
                        activeDayPlan.reason
                      }
                    </p>
                  )}

                  <div
                    style={{
                      display:
                        "grid",
                      gap:
                        "9px",
                      marginTop:
                        "14px",
                    }}
                  >

                    {Array.isArray(
                      activeDayPlan.places
                    ) &&
                    activeDayPlan
                      .places
                      .length > 0 ? (
                      activeDayPlan.places.map(
                        (
                          place,
                          index
                        ) => (
                          <div
                            key={`${getPlaceKey(
                              place
                            )}-${index}`}
                            style={{
                              background:
                                "white",
                              padding:
                                "14px",
                              borderRadius:
                                "12px",
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              alignItems:
                                "center",
                              gap:
                                "12px",
                            }}
                          >

                            <div>

                              <strong>
                                {index +
                                  1}
                                .{" "}
                                {
                                  place.name
                                }
                              </strong>

                              {place.category && (
                                <small
                                  style={{
                                    display:
                                      "block",
                                    marginTop:
                                      "4px",
                                    color:
                                      "#68756d",
                                  }}
                                >
                                  {
                                    place.category
                                  }
                                </small>
                              )}

                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                focusPlace(
                                  place
                                )
                              }
                              style={{
                                border:
                                  "none",
                                background:
                                  "#17221d",
                                color:
                                  "white",
                                borderRadius:
                                  "8px",
                                padding:
                                  "8px 10px",
                                cursor:
                                  "pointer",
                              }}
                            >
                              Map
                            </button>

                          </div>
                        )
                      )
                    ) : (
                      <p
                        style={{
                          color:
                            "#68756d",
                        }}
                      >
                        No specific
                        attraction
                        assigned for
                        this day.
                      </p>
                    )}

                  </div>

                </div>
              )}

            </div>

            {/* =================================================
                HOTELS
            ================================================= */}

            <div
              className="result-section"
              style={{
                marginTop:
                  "30px",
              }}
            >

              <div className="result-section-header">

                <div>

                  <p className="small-label">
                    STAY
                  </p>

                  <h3>
                    Budget-friendly
                    hotels
                  </h3>

                </div>

                <span className="result-count">
                  {affordableHotels.length} affordable
                </span>

              </div>

              <div className="result-grid">

                {recommendedHotels.length >
                0 ? (
                  recommendedHotels.map(
                    (hotel) => {

                      const price =
                        hasPrice(
                          hotel.price_per_night
                        );

                      const hotelBudget =
                        Number(
                          budgetSummary.hotelBudgetTotal ??
                            budgetSummary.hotelBudget ??
                            Number(totalBudget) *
                              0.45
                        ) || 0;

                      const affordable =
                        price &&
                        Number(
                          hotel.price_per_night
                        ) <=
                          hotelBudget;

                      const selected =
                        selectedBudgetHotel &&
                        getHotelKey(
                          selectedBudgetHotel
                        ) ===
                          getHotelKey(
                            hotel
                          );

                      return (
                        <div
                          className="result-card"
                          key={getHotelKey(
                            hotel
                          )}
                          style={{
                            border:
                              selected
                                ? "2px solid #8b4513"
                                : undefined,
                          }}
                        >

                          <div className="result-card-icon">
                            🏨
                          </div>

                          <div>

                            <h4>
                              {
                                hotel.name
                              }
                            </h4>

                            {hotel.rating !=
                              null && (
                              <div className="hotel-rating">
                                ⭐{" "}
                                {
                                  hotel.rating
                                }
                              </div>
                            )}

                            {hotel.address && (
                              <p>
                                📍{" "}
                                {
                                  hotel.address
                                }
                              </p>
                            )}

                            <strong>
                              {price
                                ? `${money(
                                    hotel.price_per_night
                                  )} / night`
                                : "Price not available"}
                            </strong>

                            {affordable && (
                              <span
                                style={{
                                  display:
                                    "block",
                                  color:
                                    "#315c3b",
                                  fontSize:
                                    "12px",
                                  marginTop:
                                    "6px",
                                }}
                              >
                                ✓ Within
                                planning
                                budget
                              </span>
                            )}

                            {selected && (
                              <span
                                style={{
                                  display:
                                    "block",
                                  color:
                                    "#8b4513",
                                  fontSize:
                                    "12px",
                                  marginTop:
                                    "5px",
                                  fontWeight:
                                    "700",
                                }}
                              >
                                ⭐ AI budget
                                selection
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                focusHotel(
                                  hotel
                                )
                              }
                              style={{
                                marginTop:
                                  "10px",
                                width:
                                  "100%",
                                border:
                                  "none",
                                borderRadius:
                                  "8px",
                                padding:
                                  "9px 12px",
                                background:
                                  "#8b4513",
                                color:
                                  "white",
                                cursor:
                                  "pointer",
                                fontWeight:
                                  "600",
                              }}
                            >
                              🗺️ View on map
                            </button>

                          </div>

                        </div>
                      );
                    }
                  )
                ) : (
                  <p className="empty-message">
                    No hotels were
                    found for this
                    destination.
                  </p>
                )}

              </div>

            </div>

            {/* =================================================
                AI ADVICE
            ================================================= */}

            {(aiRecommendations.transportAdvice ||
              aiRecommendations.costRange) && (
              <div
                className="result-section"
                style={{
                  marginTop:
                    "30px",
                }}
              >

                <div
                  style={{
                    padding:
                      "22px",
                    background:
                      "#f5f8f5",
                    borderRadius:
                      "18px",
                  }}
                >

                  <p className="small-label">
                    GEMINI AI
                  </p>

                  <h3>
                    Smart travel advice
                  </h3>

                  {aiRecommendations.transportAdvice && (
                    <p
                      style={{
                        color:
                          "#526058",
                        lineHeight:
                          "1.6",
                      }}
                    >
                      🚗{" "}
                      {
                        aiRecommendations.transportAdvice
                      }
                    </p>
                  )}

                  {aiRecommendations.costRange && (
                    <p
                      style={{
                        color:
                          "#526058",
                      }}
                    >
                      💰 AI approximate
                      range:{" "}
                      <strong>
                        {money(
                          aiRecommendations
                            .costRange
                            .minimum
                        )}
                      </strong>{" "}
                      –{" "}
                      <strong>
                        {money(
                          aiRecommendations
                            .costRange
                            .maximum
                        )}
                      </strong>
                    </p>
                  )}

                  {Array.isArray(
                    aiRecommendations.warnings
                  ) &&
                    aiRecommendations
                      .warnings
                      .length >
                      0 && (
                      <div
                        style={{
                          marginTop:
                            "12px",
                          color:
                            "#8a5b1b",
                        }}
                      >
                        {aiRecommendations.warnings.map(
                          (
                            warning,
                            index
                          ) => (
                            <p
                              key={
                                index
                              }
                            >
                              ⚠️{" "}
                              {
                                warning
                              }
                            </p>
                          )
                        )}
                      </div>
                    )}

                </div>

              </div>
            )}

            {/* =================================================
                MAP
            ================================================= */}

            <div
              className="tourism-map-section"
              style={{
                marginTop:
                  "30px",
              }}
            >

              <TourismMap
                places={
                  mapPlaces
                }
                hotels={
                  mapHotels
                }
                destination={
                  trip.destination
                }
              />

            </div>

          </section>
        )}

        {/* =================================================
            FEATURES
        ================================================= */}

        <section
          id="features"
          className="features-section"
        >

          <div className="section-heading">

            <p className="small-label">
              WHY SMARTTOURISM?
            </p>

            <h2>
              Travel planning,
              simplified.
            </h2>

            <p>
              Real data + AI +
              budget + routes in
              one travel planner.
            </p>

          </div>

          <div className="feature-grid">

            <div className="feature-card">

              <div className="feature-icon">
                🤖
              </div>

              <h3>
                AI Recommendations
              </h3>

              <p>
                Gemini analyzes your
                budget, interests and
                available options to
                create a practical
                trip.
              </p>

            </div>

            <div className="feature-card">

              <div className="feature-icon">
                💰
              </div>

              <h3>
                Budget First
              </h3>

              <p>
                Your total budget is
                considered before
                selecting hotels,
                activities and
                transport.
              </p>

            </div>

            <div className="feature-card">

              <div className="feature-icon">
                🗺️
              </div>

              <h3>
                Real Routes
              </h3>

              <p>
                Routes are calculated
                using road-network
                data instead of simply
                guessing distances.
              </p>

            </div>

            <div className="feature-card">

              <div className="feature-icon">
                🏨
              </div>

              <h3>
                Smart Stay
              </h3>

              <p>
                Hotels are discovered
                dynamically and ranked
                according to your
                planning budget.
              </p>

            </div>

          </div>

        </section>

        {/* =================================================
            ABOUT
        ================================================= */}

        <section
          id="about"
          className="about-section"
        >

          <div>

            <p className="small-label">
              BUILT FOR MODERN
              TOURISM
            </p>

            <h2>
              One smart platform
              for every journey.
            </h2>

          </div>

          <p>
            SmartTourism combines
            OpenStreetMap data,
            road routing, budget
            optimization and Gemini
            AI to create practical
            personalized journeys.
          </p>

        </section>

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer>

          <div className="logo">
            <span>✦</span>
            SmartTourism
          </div>

          <p>
            AI-powered travel
            planning for smarter
            journeys.
          </p>

        </footer>

      </div>
    </>
  );
}

export default App;