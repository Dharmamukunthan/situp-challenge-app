import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";import { ChevronRight, Shield, Sun, Moon, Trophy } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export default function Landing() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[var(--clay-radius)] bg-[var(--primary)] flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-foreground">Situp Challenge</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={toggleTheme}
              className="clay-btn w-9 h-9 p-0"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>
            <Button
              onClick={() => navigate("/auth")}
              className="clay-btn h-9 px-5 text-sm font-medium"
            >
              Sign In
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-4 pt-16 pb-24 md:pt-24 md:pb-36">
        <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-[var(--primary)]/8 blur-3xl" />
        <div className="absolute bottom-10 right-10 w-56 h-56 rounded-full bg-[var(--accent)]/10 blur-3xl" />

        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 clay-card px-4 py-2 mb-8">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-muted-foreground">Camera-Powered Rep Tracking</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-black text-foreground leading-tight mb-6">
              Count situps
              <br />
              <span className="text-[var(--primary)]">with precision.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Point your front camera, start a session, and let pose detection
              count every rep. Compete on the leaderboard or challenge someone
              to a head-to-head battle.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate("/auth")}
                className="clay-btn h-14 px-8 text-lg font-semibold"
              >
                Get Started
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </motion.div>

          {/* Hero mockup */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-16 md:mt-20"
          >
            <div className="clay-card-lg p-4 max-w-lg mx-auto">
              <div className="aspect-[4/3] rounded-[var(--clay-radius)] bg-gradient-to-br from-[var(--primary)]/15 via-[var(--secondary)]/10 to-[var(--accent)]/15 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="clay-counter w-32 h-32 text-5xl font-black mb-4 animate-bounce">
                  <Trophy className="w-10 h-10" />
                </div>
                <p className="text-2xl font-bold text-foreground">0 reps</p>
                <p className="text-sm text-muted-foreground mt-1">Start counting</p>

                <motion.div
                  animate={{ y: [-5, 5, -5] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute top-4 right-4 clay-pill bg-[var(--accent)]/25 px-3 py-1"
                >
                  <span className="text-xs font-medium text-foreground">+1 rep</span>
                </motion.div>
                <motion.div
                  animate={{ y: [5, -5, 5] }}
                  transition={{ repeat: Infinity, duration: 2.5 }}
                  className="absolute bottom-6 left-4 clay-pill bg-[var(--primary)]/15 px-3 py-1"
                >
                  <span className="text-xs font-medium text-foreground">Goal: 100</span>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="clay-card-lg p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4">
              Start counting today
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">
              No app to install. No hardware required. Just your browser, your camera, and 100 reps.
            </p>
            <Button
              onClick={() => navigate("/auth")}
              className="clay-btn h-14 px-10 text-lg font-semibold"
            >
              Open the Challenge
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 text-center border-t border-[var(--border)]">
        <p className="text-sm text-muted-foreground">
          Situp Challenge — built on{" "}
          <a href="https://freebuff.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--primary)] transition-colors">
            Freebuff
          </a>
        </p>
      </footer>
    </div>
  );
}
