import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { Camera, Swords, Trophy, Target, Zap, ChevronRight } from "lucide-react";

const features = [
  {
    icon: Camera,
    title: "AI Camera Counting",
    desc: "Your front camera detects and counts every situp automatically using pose detection.",
  },
  {
    icon: Swords,
    title: "1v1 Battles",
    desc: "Challenge friends or strangers. Share a QR code, start a battle, see who cranks out more reps.",
  },
  {
    icon: Trophy,
    title: "Daily Goals",
    desc: "Track your daily situp streak and watch your progress grow over time.",
  },
  {
    icon: Zap,
    title: "Instant Results",
    desc: "Real-time rep counting, score updates, and battle results — no delays.",
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Hero */}
      <section className="relative px-4 pt-12 pb-20 md:pt-20 md:pb-32">
        {/* Decorative blobs */}
        <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-[var(--primary)]/10 blur-3xl" />
        <div className="absolute bottom-10 right-10 w-56 h-56 rounded-full bg-[var(--accent)]/15 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-[var(--secondary)]/10 blur-3xl" />

        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 clay-card px-4 py-2 mb-8">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-muted-foreground">AI-Powered Situp Counter</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-black text-foreground leading-tight mb-6">
              Count every rep.
              <br />
              <span className="text-[var(--primary)]">Battle your friends.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Your front camera watches your form, counts your situps automatically,
              and lets you battle anyone in real-time. Hit 100 reps daily and
              climb the leaderboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate("/auth")}
                className="clay-btn h-14 px-8 text-lg font-semibold"
              >
                Get Started Free
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                onClick={() => navigate("/auth")}
                className="clay-btn h-14 px-8 text-lg font-semibold"
                style={{ background: "var(--secondary)", color: "var(--secondary-foreground)" }}
              >
                Try as Guest
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
              <div className="aspect-[4/3] rounded-[var(--clay-radius)] bg-gradient-to-br from-[var(--primary)]/20 via-[var(--secondary)]/20 to-[var(--accent)]/20 flex flex-col items-center justify-center relative overflow-hidden">
                {/* Animated counter */}
                <div className="clay-counter w-32 h-32 text-5xl font-black mb-4 animate-bounce">
                  <Target className="w-10 h-10" />
                </div>
                <p className="text-2xl font-bold text-foreground">42 reps</p>
                <p className="text-sm text-muted-foreground mt-1">Today&apos;s session</p>

                {/* Floating elements */}
                <motion.div
                  animate={{ y: [-5, 5, -5] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute top-4 right-4 clay-pill bg-[var(--accent)]/30 px-3 py-1"
                >
                  <span className="text-xs font-medium text-foreground">⚡ +1 rep</span>
                </motion.div>
                <motion.div
                  animate={{ y: [5, -5, 5] }}
                  transition={{ repeat: Infinity, duration: 2.5 }}
                  className="absolute bottom-6 left-4 clay-pill bg-[var(--primary)]/20 px-3 py-1"
                >
                  <span className="text-xs font-medium text-foreground">🎯 Goal: 100</span>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-20 md:py-28">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4">
              Everything you need
            </h2>
            <p className="text-muted-foreground text-lg">
              Built for daily training, made for competition
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="clay-card p-6 group hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 rounded-[var(--clay-radius)] bg-[var(--primary)]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feat.icon className="w-6 h-6 text-[var(--primary)]" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof / stats */}
      <section className="px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="clay-card-lg p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-black text-foreground mb-6">
              Join the situp revolution
            </h2>
            <div className="grid grid-cols-3 gap-6 mb-8">
              {[
                { val: "100+", label: "Reps/Day" },
                { val: "1v1", label: "Battles" },
                { val: "24/7", label: "Available" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-3xl font-black text-[var(--primary)]">{stat.val}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
            <Button
              onClick={() => navigate("/auth")}
              className="clay-btn h-14 px-10 text-lg font-semibold"
            >
              Start Training Now
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Built with 💪 for daily grinders.{" "}
          <a href="https://freebuff.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--primary)] transition-colors">
            freebuff.com
          </a>
        </p>
      </footer>
    </div>
  );
}
