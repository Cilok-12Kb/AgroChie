import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { countLoginMethods, wouldLoseLastLoginMethod } from "../src/utils/login-methods.js";

const H = "$argon2id$hash";

describe("countLoginMethods", () => {
  test("semua kombinasi passwordHash x (phone, email) x googleId", () => {
    for (const hash of [null, H]) {
      for (const phone of [null, "0811"]) {
        for (const email of [null, "a@b.test"]) {
          for (const googleId of [null, "g1"]) {
            const expected = Number(Boolean(hash && (phone || email))) + Number(Boolean(googleId));
            assert.equal(
              countLoginMethods({ passwordHash: hash, phone, email, googleId }),
              expected,
              JSON.stringify({ hash: !!hash, phone: !!phone, email: !!email, googleId: !!googleId }),
            );
          }
        }
      }
    }
  });

  test("kasus kunci", () => {
    assert.equal(countLoginMethods({ passwordHash: H, phone: "0811", email: null, googleId: null }), 1);
    assert.equal(countLoginMethods({ passwordHash: H, phone: null, email: "a@b.test", googleId: null }), 1);
    assert.equal(countLoginMethods({ passwordHash: H, phone: null, email: null, googleId: null }), 0); // tanpa identifier
    assert.equal(countLoginMethods({ passwordHash: null, phone: "0811", email: "a@b.test", googleId: null }), 0);
    assert.equal(countLoginMethods({ passwordHash: null, phone: null, email: "a@b.test", googleId: "g1" }), 1);
    assert.equal(countLoginMethods({ passwordHash: H, phone: "0811", email: "a@b.test", googleId: "g1" }), 2);
  });

  test("string kosong dan undefined dianggap tidak ada; input kosong tidak melempar", () => {
    assert.equal(countLoginMethods({ passwordHash: "", phone: "0811", googleId: "" }), 0);
    assert.equal(countLoginMethods({}), 0);
    assert.equal(countLoginMethods(null), 0);
    assert.equal(countLoginMethods(undefined), 0);
  });
});

describe("wouldLoseLastLoginMethod", () => {
  const both = { passwordHash: H, phone: "0811", email: "a@b.test", googleId: "g1" };
  const googleOnly = { passwordHash: null, phone: null, email: "a@b.test", googleId: "g1" };
  const passwordOnly = { passwordHash: H, phone: "0811", email: null, googleId: null };
  const emailPassword = { passwordHash: H, phone: null, email: "a@b.test", googleId: null };

  test("punya dua metode: melepas salah satunya aman", () => {
    assert.equal(wouldLoseLastLoginMethod(both, { googleId: null }), false);
    assert.equal(wouldLoseLastLoginMethod(both, { passwordHash: null }), false);
  });

  test("melepas Google dari akun Google-only -> kehilangan metode terakhir", () => {
    assert.equal(wouldLoseLastLoginMethod(googleOnly, { googleId: null }), true);
  });

  test("akun password-only: menghapus password, atau identifier terakhirnya, menghilangkan metode terakhir", () => {
    assert.equal(wouldLoseLastLoginMethod(passwordOnly, { passwordHash: null }), true);
    assert.equal(wouldLoseLastLoginMethod(passwordOnly, { phone: null }), true);
    assert.equal(wouldLoseLastLoginMethod(emailPassword, { email: null }), true);
  });

  test("masih ada identifier lain: menghapus email aman bila phone ada, dan sebaliknya", () => {
    assert.equal(wouldLoseLastLoginMethod({ ...passwordOnly, email: "a@b.test" }, { email: null }), false);
    assert.equal(wouldLoseLastLoginMethod({ ...emailPassword, phone: "0811" }, { phone: null }), false);
  });

  test("menghapus email dari akun Google-only tidak menghilangkan Google", () => {
    assert.equal(wouldLoseLastLoginMethod(googleOnly, { email: null }), false);
  });

  test("tanpa perubahan: aman bila punya metode, true bila sejak awal tidak punya (diblokir demi keamanan)", () => {
    assert.equal(wouldLoseLastLoginMethod(both), false);
    assert.equal(wouldLoseLastLoginMethod({ passwordHash: null, phone: null, email: null, googleId: null }), true);
  });

  test("tidak mengubah objek user asli", () => {
    const u = { ...googleOnly };
    wouldLoseLastLoginMethod(u, { googleId: null });
    assert.deepEqual(u, googleOnly);
  });
});
