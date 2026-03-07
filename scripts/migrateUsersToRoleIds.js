import mongoose from "mongoose";
import dotenv from "dotenv";
import Role from "../models/roleModel.js";

dotenv.config();

/** Map legacy string role to role name (cashier -> salesman). */
const roleNameMap = { cashier: "salesman" };

async function migrateUsersToRoleIds() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    const usersCol = db.collection("users");
    const rolesCol = db.collection("roles");

    const roles = await rolesCol.find({}).toArray();
    const roleByName = {};
    for (const r of roles) {
      roleByName[r.name] = r._id;
    }

    const users = await usersCol.find({}).toArray();
    let updated = 0;
    for (const user of users) {
      const roleVal = user.role;
      if (!roleVal) continue;
      // Already ObjectId
      if (roleVal instanceof mongoose.Types.ObjectId) continue;
      const roleName = roleNameMap[roleVal] || roleVal;
      const roleId = roleByName[roleName];
      if (!roleId) {
        console.warn(`No role found for "${roleVal}" (mapped to "${roleName}"), skipping user ${user.email}`);
        continue;
      }
      await usersCol.updateOne(
        { _id: user._id },
        { $set: { role: roleId } }
      );
      updated++;
      console.log(`Updated user ${user.email} -> role ${roleName}`);
    }
    console.log(`✅ Migration complete. Updated ${updated} users.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrateUsersToRoleIds();
