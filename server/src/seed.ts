import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "pipeline.db");

// Delete existing database file FIRST
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
}

// Use dynamic imports to ensure database module loads AFTER file deletion
async function main() {
  const { initDb } = await import("./db/database.js");
  const { createCandidate, transitionCandidate } = await import("./db/repository.js");

  initDb();

  const now = new Date();

  console.log("Seeding database...");

  // Helper to create timestamps for a candidate's timeline
  function createTimeline(baseMs: number, steps: number): Date[] {
    return Array.from({ length: steps }, (_, i) => new Date(baseMs + i * 1000));
  }

  // Candidate 1: Priya Sharma - in Screening (1 transition)
  const priya = createCandidate({ name: "Priya Sharma", email: "priya.sharma@example.com" });
  console.log(`Created: ${priya.name} (id: ${priya.id})`);
  const priyaBase = new Date((priya as any)._createdAt).getTime();
  const priyaTimes = createTimeline(priyaBase, 1);
  transitionCandidate(priya.id, { to: "Screening", expectedStage: "Applied", note: "Screening started" }, priyaTimes[0]);

  // Candidate 2: Rajesh Kumar - in Interview (2 transitions)
  const rajesh = createCandidate({ name: "Rajesh Kumar", email: "rajesh.kumar@example.com" });
  console.log(`Created: ${rajesh.name} (id: ${rajesh.id})`);
  const rajeshBase = new Date((rajesh as any)._createdAt).getTime();
  const rajeshTimes = createTimeline(rajeshBase, 2);
  transitionCandidate(rajesh.id, { to: "Screening", expectedStage: "Applied" }, rajeshTimes[0]);
  transitionCandidate(rajesh.id, { to: "Interview", expectedStage: "Screening", note: "Technical interview scheduled" }, rajeshTimes[1]);

  // Candidate 3: Anjali Mehta - in Offer (3 transitions)
  const anjali = createCandidate({ name: "Anjali Mehta", email: "anjali.mehta@example.com" });
  console.log(`Created: ${anjali.name} (id: ${anjali.id})`);
  const anjaliBase = new Date((anjali as any)._createdAt).getTime();
  const anjaliTimes = createTimeline(anjaliBase, 3);
  transitionCandidate(anjali.id, { to: "Screening", expectedStage: "Applied" }, anjaliTimes[0]);
  transitionCandidate(anjali.id, { to: "Interview", expectedStage: "Screening" }, anjaliTimes[1]);
  transitionCandidate(anjali.id, { to: "Offer", expectedStage: "Interview", note: "Offer extended" }, anjaliTimes[2]);

  // Candidate 4: Vikram Singh - Rejected from Interview (3 transitions)
  const vikram = createCandidate({ name: "Vikram Singh", email: "vikram.singh@example.com" });
  console.log(`Created: ${vikram.name} (id: ${vikram.id})`);
  const vikramBase = new Date((vikram as any)._createdAt).getTime();
  const vikramTimes = createTimeline(vikramBase, 3);
  transitionCandidate(vikram.id, { to: "Screening", expectedStage: "Applied" }, vikramTimes[0]);
  transitionCandidate(vikram.id, { to: "Interview", expectedStage: "Screening" }, vikramTimes[1]);
  transitionCandidate(vikram.id, { to: "Rejected", expectedStage: "Interview", note: "Not a fit for role" }, vikramTimes[2]);

  // Candidate 5: Neha Patel - Hired (4 transitions)
  const neha = createCandidate({ name: "Neha Patel", email: "neha.patel@example.com" });
  console.log(`Created: ${neha.name} (id: ${neha.id})`);
  const nehaBase = new Date((neha as any)._createdAt).getTime();
  const nehaTimes = createTimeline(nehaBase, 4);
  transitionCandidate(neha.id, { to: "Screening", expectedStage: "Applied" }, nehaTimes[0]);
  transitionCandidate(neha.id, { to: "Interview", expectedStage: "Screening" }, nehaTimes[1]);
  transitionCandidate(neha.id, { to: "Offer", expectedStage: "Interview", note: "Offer accepted" }, nehaTimes[2]);
  transitionCandidate(neha.id, { to: "Hired", expectedStage: "Offer", note: "Joined the team" }, nehaTimes[3]);

  // Candidate 6: Amit Shah - Applied recently
  const amit = createCandidate({ name: "Amit Shah", email: "amit.shah@example.com" });
  console.log(`Created: ${amit.name} (id: ${amit.id})`);

  // Candidate 7: Sunita Reddy - Applied
  const sunita = createCandidate({ name: "Sunita Reddy", email: "sunita.reddy@example.com" });
  console.log(`Created: ${sunita.name} (id: ${sunita.id})`);

  // Candidate 8: Rahul Gupta - in Screening (1 transition)
  const rahul = createCandidate({ name: "Rahul Gupta", email: "rahul.gupta@example.com" });
  console.log(`Created: ${rahul.name} (id: ${rahul.id})`);
  const rahulBase = new Date((rahul as any)._createdAt).getTime();
  const rahulTimes = createTimeline(rahulBase, 1);
  transitionCandidate(rahul.id, { to: "Screening", expectedStage: "Applied", note: "Phone screen scheduled" }, rahulTimes[0]);

  // Candidate 9: Kavya Nair - in Interview (2 transitions)
  const kavya = createCandidate({ name: "Kavya Nair", email: "kavya.nair@example.com" });
  console.log(`Created: ${kavya.name} (id: ${kavya.id})`);
  const kavyaBase = new Date((kavya as any)._createdAt).getTime();
  const kavyaTimes = createTimeline(kavyaBase, 2);
  transitionCandidate(kavya.id, { to: "Screening", expectedStage: "Applied" }, kavyaTimes[0]);
  transitionCandidate(kavya.id, { to: "Interview", expectedStage: "Screening", note: "Onsite interview" }, kavyaTimes[1]);

  // Candidate 10: Arjun Desai - reached Offer, then rejected (4 transitions)
  const arjun = createCandidate({ name: "Arjun Desai", email: "arjun.desai@example.com" });
  console.log(`Created: ${arjun.name} (id: ${arjun.id})`);
  const arjunBase = new Date((arjun as any)._createdAt).getTime();
  const arjunTimes = createTimeline(arjunBase, 4);
  transitionCandidate(arjun.id, { to: "Screening", expectedStage: "Applied" }, arjunTimes[0]);
  transitionCandidate(arjun.id, { to: "Interview", expectedStage: "Screening" }, arjunTimes[1]);
  transitionCandidate(arjun.id, { to: "Offer", expectedStage: "Interview", note: "Offer made" }, arjunTimes[2]);
  transitionCandidate(arjun.id, { to: "Rejected", expectedStage: "Offer", note: "Declined offer" }, arjunTimes[3]);

  // Candidate 11: Priya Sharma (duplicate name for fuzzy test)
  const priya2 = createCandidate({ name: "Priya Shrama", email: "priya.shrama@example.com" });
  console.log(`Created: ${priya2.name} (id: ${priya2.id})`);
  const priya2Base = new Date((priya2 as any)._createdAt).getTime();
  const priya2Times = createTimeline(priya2Base, 1);
  transitionCandidate(priya2.id, { to: "Screening", expectedStage: "Applied" }, priya2Times[0]);

  // Candidate 12: Test fuzzy matching - "pryia"
  const pryia = createCandidate({ name: "Pryia Sharma", email: "pryia.sharma@example.com" });
  console.log(`Created: ${pryia.name} (id: ${pryia.id})`);
  const pryiaBase = new Date((pryia as any)._createdAt).getTime();
  const pryiaTimes = createTimeline(pryiaBase, 1);
  transitionCandidate(pryia.id, { to: "Screening", expectedStage: "Applied" }, pryiaTimes[0]);

  console.log("\nSeeding complete!");
  console.log("Test queries:");
  console.log("  - 'Priya Sharma' (exact match)");
  console.log("  - 'sharam' (fuzzy match -> Priya Sharma)");
  console.log("  - 'in interview' (Rajesh, Kavya)");
  console.log("  - 'reached offer not hired' (Anjali in Offer, Arjun rejected from Offer)");
  console.log("  - 'except rejected' (all except Vikram and Arjun)");
}

main().catch(console.error);