import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/common/Card";

interface ScenarioItem {
  id: string;
  label: string;
  image: string;
}

interface Category {
  id: string;
  title: string;
  description: string;
  image: string;
  color: string;
  border: string;
  trainingOptions: ScenarioItem[];
  practiceOptions: ScenarioItem[];
}

const CATEGORIES: Category[] = [
  {
    id: "general",
    title: "General Social",
    description:
      "Everyday conversations to build confidence and conversational agility.",
    image: "/resources/sim_env_imgs/dojo.png",
    color: "from-blue-500/20 to-blue-600/5",
    border: "border-blue-500/30",
    trainingOptions: [
      {
        id: "dojo",
        label: "Downward Inflection & Pausing Power",
        image: "/resources/sim_env_imgs/dojo.png",
      },
    ],
    practiceOptions: [],
  },
  {
    id: "interview",
    title: "Interview Prep",
    description:
      "High-stakes practice for technical and behavioral interviews.",
    image: "/resources/sim_env_imgs/interview_at_tech.png",
    color: "from-purple-500/20 to-purple-600/5",
    border: "border-purple-500/30",
    trainingOptions: [      
        {
        id: "star_interview_training",
        label: "STAR technique",
        image: "/resources/sim_env_imgs/interview_training.png",
      },
    ],
    practiceOptions: [
      {
        id: "tech_interview",
        label: "Tech Interview",
        image: "/resources/sim_env_imgs/interview_at_tech.png",
      },
    {
        id: "fin_interview",
        label: "Finance Interview",
        image: "/resources/sim_env_imgs/finance_interview.png",
      },
    ],
  },
  {
    id: "dating",
    title: "Dating & Romance",
    description: "Read the room, practice flirting, and test your charm.",
    image: "/resources/sim_env_imgs/pickup_at_bar.png",
    color: "from-rose-500/20 to-rose-600/5",
    border: "border-rose-500/30",
    trainingOptions: [
      {
        id: "masculine_frame_training",
        label: "Masculine Frame Techniques",
        image: "/resources/sim_env_imgs/dating_training.png",
      },
    ],
    practiceOptions: [
      {
        id: "bar_pickup",
        label: "Pickup at the bar",
        image: "/resources/sim_env_imgs/pickup_at_bar.png",
      },
      {
        id: "high_end_dinner_date",
        label: "High-end dinner date",
        image: "/resources/sim_env_imgs/high_end_dinner_date.png",
      },
      {
        id: "park_date",
        label: "Park date",
        image: "/resources/sim_env_imgs/park_date.png",
      },
    ],
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );

  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
  };

  const handleBack = () => {
    setSelectedCategoryId(null);
  };

  const handleLaunchSim = (
    scenarioId: string,
    mode: "training" | "practice",
  ) => {
    void navigate(`/simulation?scenarioId=${scenarioId}&mode=${mode}`);
  };

  const selectedCategory = CATEGORIES.find((c) => c.id === selectedCategoryId);

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center p-8 overflow-y-auto">
      {/* Header */}
      <div className="max-w-5xl w-full text-left mt-12 mb-10 flex items-center gap-4">
        {selectedCategory && (
          <button
            onClick={handleBack}
            className="p-2 bg-neutral-800/50 hover:bg-neutral-800 rounded-full transition-colors text-neutral-400 hover:text-white mb-4"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
        )}
        <div>
          <h1 className="text-5xl font-extrabold tracking-tight bg-linear-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent mb-4 transition-all">
            {selectedCategory ? selectedCategory.title : "Select Scenario"}
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl">
            {selectedCategory
              ? "Choose your specific simulation below."
              : "Choose an environment to train your social skills."}
          </p>
        </div>
      </div>

      {/* View State: Root Categories */}
      {!selectedCategory && (
        <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-3 gap-6">
          {CATEGORIES.map((category) => (
            <div
              key={category.id}
              onClick={() => handleSelectCategory(category.id)}
              className="cursor-pointer"
            >
              <Card
                className={`relative overflow-hidden group border ${category.border} bg-linear-to-b ${category.color} backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:shadow-${category.border.split("-")[1]}-500/10 hover:-translate-y-1 flex flex-col h-full`}
                noPadding
              >
                {/* Category Image header */}
                <div className="relative h-48 w-full overflow-hidden">
                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent z-10" />
                  <img
                    src={category.image}
                    alt={category.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                </div>
                {/* Content */}
                <div className="p-6 flex-1 flex flex-col text-left">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {category.title}
                  </h2>
                  <p className="text-neutral-400 text-sm flex-1">
                    {category.description}
                  </p>
                  <div className="mt-6 flex items-center justify-between text-neutral-300 font-medium group-hover:text-white transition-colors">
                    <span>View Options</span>
                    <svg
                      className="w-5 h-5 transform group-hover:translate-x-1 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* View State: Detail / Sub-selection */}
      {selectedCategory && (
        <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Training Column */}
          <Card className="bg-neutral-900/50 border border-neutral-800 flex flex-col gap-4">
            <div className="border-b border-neutral-700 pb-4 mb-2 flex items-center gap-2">
              <span className="bg-blue-500/20 text-blue-400 p-1.5 rounded-md">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                  />
                </svg>
              </span>
              <h2 className="text-2xl font-bold text-neutral-100">
                Training Scenarios
              </h2>
            </div>

            {selectedCategory.trainingOptions.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8 border border-dashed border-neutral-700 rounded-xl bg-neutral-800/30 text-neutral-500 italic">
                More training modules coming soon.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {selectedCategory.trainingOptions.map((option) => (
                  <div
                    key={option.id}
                    onClick={() => handleLaunchSim(option.id, "training")}
                    className="group relative overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800 hover:border-blue-500/50 transition-colors cursor-pointer flex items-center p-3 gap-4"
                  >
                    <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0">
                      <img
                        src={option.image}
                        alt={option.label}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors">
                        {option.label}
                      </h3>
                      <p className="text-sm text-neutral-400 mt-1">
                        Guided simulation to boost specific skills.
                      </p>
                    </div>
                    <div className="shrink-0 p-2 text-neutral-500 group-hover:text-blue-400 transition-colors">
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Practice Column */}
          <Card className="bg-neutral-900/50 border border-neutral-800 flex flex-col gap-4">
            <div className="border-b border-neutral-700 pb-4 mb-2 flex items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-400 p-1.5 rounded-md">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </span>
              <h2 className="text-2xl font-bold text-neutral-100">
                Practice Scenarios
              </h2>
            </div>

            {selectedCategory.practiceOptions.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8 border border-dashed border-neutral-700 rounded-xl bg-neutral-800/30 text-neutral-500 italic">
                More practice modules coming soon.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {selectedCategory.practiceOptions.map((option) => (
                  <div
                    key={option.id}
                    onClick={() => handleLaunchSim(option.id, "practice")}
                    className="group relative overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800 hover:border-emerald-500/50 transition-colors cursor-pointer flex items-center p-3 gap-4"
                  >
                    <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0">
                      <img
                        src={option.image}
                        alt={option.label}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                        {option.label}
                      </h3>
                      <p className="text-sm text-neutral-400 mt-1">
                        Open-ended interaction for freeform practice.
                      </p>
                    </div>
                    <div className="shrink-0 p-2 text-neutral-500 group-hover:text-emerald-400 transition-colors">
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
