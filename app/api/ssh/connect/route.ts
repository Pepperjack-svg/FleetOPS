import { NextResponse } from "next/server";
import { Client } from "ssh2";
import db from "@/lib/db";
import { createPrivateKey } from "crypto";

export async function POST(req: Request) {
  try {
    const { host, port, username, password, ssh_key_id, passphrase } = await req.json();

    const sshKey = ssh_key_id
      ? (db
          .prepare("SELECT private_key FROM ssh_keys WHERE id = ?")
          .get(ssh_key_id) as { private_key?: string } | undefined)
      : undefined;

    let privateKey: string | Buffer | undefined = sshKey?.private_key;

    // ✅ Handle encrypted keys gracefully
    if (privateKey?.includes("ENCRYPTED")) {
      if (!passphrase) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Private key is encrypted — please provide the correct passphrase.",
          },
          { status: 400 }
        );
      }

      try {
        const keyObj = createPrivateKey({
          key: privateKey,
          format: "pem",
          passphrase,
        });
        privateKey = keyObj.export({ format: "pem", type: "pkcs1" });
      } catch (error) {
        console.error("Key decryption failed:", error);
        return NextResponse.json(
          {
            success: false,
            message: "Invalid passphrase or unsupported key format.",
          },
          { status: 400 }
        );
      }
    }

    const conn = new Client();

    await new Promise<void>((resolve, reject) => {
      conn
        .on("ready", () => {
          db.prepare(
            "UPDATE remote_servers SET status = ? WHERE host = ?"
          ).run("connected", host);
          conn.end();
          resolve();
        })
        .on("error", (err) => reject(err))
        .connect({
          host,
          port: port || 22,
          username,
          password,
          privateKey,
          passphrase,
        });
    });

    return NextResponse.json({
      success: true,
      message: "Connected successfully",
    });
  } catch (err: any) {
    console.error("SSH connection failed:", err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
