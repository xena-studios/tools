// Where each face of a skin sits in its PNG, and where it goes in a flat
// front or back view, 16 by 32 skin pixels. A 64×64 skin has its own left arm
// and leg and an outer layer for every part; a 64×32 (before 1.8) has neither,
// so the left limbs are the right ones mirrored. A slim (Alex) arm is 3 wide.

export type Model = "classic" | "slim";
export type View = "front" | "back";

export interface Part {
  /** Source rectangle in the skin. */
  sx: number;
  sy: number;
  w: number;
  h: number;
  /** Where it goes in the 16×32 view. */
  dx: number;
  dy: number;
  /** Draw it flipped left to right (a 64×32 skin's left limbs). */
  mirror?: boolean;
  /** The outer layer (hat, jacket, sleeves, trousers). */
  overlay?: boolean;
}

export const VIEW_W = 16;
export const VIEW_H = 32;

/**
 * The parts for one view, base layer first, then the outer layer. In the front
 * view the player's right side is on the viewer's left; in the back view it's
 * on the right.
 */
export function skinParts(view: View, model: Model, legacy: boolean): Part[] {
  const a = model === "slim" ? 3 : 4; // arm width
  const front = view === "front";
  // Viewer's left and right columns for the arms: a slim arm hugs the body.
  const leftArmX = 4 - a;
  const rightArmX = 12;
  const rightSide = front ? { arm: leftArmX, leg: 4 } : { arm: rightArmX, leg: 8 };
  const leftSide = front ? { arm: rightArmX, leg: 8 } : { arm: leftArmX, leg: 4 };

  const base: Part[] = front
    ? [
        { sx: 8, sy: 8, w: 8, h: 8, dx: 4, dy: 0 }, // head
        { sx: 20, sy: 20, w: 8, h: 12, dx: 4, dy: 8 }, // body
        { sx: 44, sy: 20, w: a, h: 12, dx: rightSide.arm, dy: 8 }, // right arm
        { sx: 4, sy: 20, w: 4, h: 12, dx: rightSide.leg, dy: 20 }, // right leg
      ]
    : [
        { sx: 24, sy: 8, w: 8, h: 8, dx: 4, dy: 0 },
        { sx: 32, sy: 20, w: 8, h: 12, dx: 4, dy: 8 },
        { sx: 44 + a + 4, sy: 20, w: a, h: 12, dx: rightSide.arm, dy: 8 },
        { sx: 12, sy: 20, w: 4, h: 12, dx: rightSide.leg, dy: 20 },
      ];

  if (legacy) {
    // The left limbs are the right ones, mirrored; the front of the left arm is
    // drawn from the right arm's front, and so on.
    const rightArm = base[2] as Part;
    const rightLeg = base[3] as Part;
    base.push(
      { ...rightArm, dx: leftSide.arm, mirror: true },
      { ...rightLeg, dx: leftSide.leg, mirror: true },
    );
  } else {
    base.push(
      front
        ? { sx: 36, sy: 52, w: a, h: 12, dx: leftSide.arm, dy: 8 }
        : { sx: 36 + a + 4, sy: 52, w: a, h: 12, dx: leftSide.arm, dy: 8 },
      front
        ? { sx: 20, sy: 52, w: 4, h: 12, dx: leftSide.leg, dy: 20 }
        : { sx: 28, sy: 52, w: 4, h: 12, dx: leftSide.leg, dy: 20 },
    );
  }

  const hat: Part = front
    ? { sx: 40, sy: 8, w: 8, h: 8, dx: 4, dy: 0, overlay: true }
    : { sx: 56, sy: 8, w: 8, h: 8, dx: 4, dy: 0, overlay: true };
  if (legacy) return [...base, hat];

  const outer: Part[] = front
    ? [
        { sx: 20, sy: 36, w: 8, h: 12, dx: 4, dy: 8 }, // jacket
        { sx: 44, sy: 36, w: a, h: 12, dx: rightSide.arm, dy: 8 }, // right sleeve
        { sx: 52, sy: 52, w: a, h: 12, dx: leftSide.arm, dy: 8 }, // left sleeve
        { sx: 4, sy: 36, w: 4, h: 12, dx: rightSide.leg, dy: 20 }, // right trouser
        { sx: 4, sy: 52, w: 4, h: 12, dx: leftSide.leg, dy: 20 }, // left trouser
      ]
    : [
        { sx: 32, sy: 36, w: 8, h: 12, dx: 4, dy: 8 },
        { sx: 44 + a + 4, sy: 36, w: a, h: 12, dx: rightSide.arm, dy: 8 },
        { sx: 52 + a + 4, sy: 52, w: a, h: 12, dx: leftSide.arm, dy: 8 },
        { sx: 12, sy: 36, w: 4, h: 12, dx: rightSide.leg, dy: 20 },
        { sx: 12, sy: 52, w: 4, h: 12, dx: leftSide.leg, dy: 20 },
      ];
  return [...base, hat, ...outer.map((p) => ({ ...p, overlay: true }))];
}

/** The outside of a cape: 10×16 at (1, 1) in its 64×32 (or older 22×17) PNG. */
export const CAPE_OUTER = { sx: 1, sy: 1, w: 10, h: 16 } as const;
