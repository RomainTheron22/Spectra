import { auth } from "../../../lib/auth";
import { headers } from "next/headers";
import { getDb } from "../../../lib/mongodb";
import { ObjectId } from "mongodb";

// GET /api/personnel - Liste tous les employés
export async function GET(request) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

        const db = await getDb();
        const employees = await db.collection("employees").find({}).sort({ lastName: 1, firstName: 1 }).toArray();

        return Response.json({ items: employees });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/personnel - Créer un employé
export async function POST(request) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

        const data = await request.json();
        const db = await getDb();

        const newEmployee = {
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            email: data.email || "",
            phone: data.phone || "",
            role: data.role || "",
            pole: data.pole || "",
            contractType: data.contractType || "",
            startDate: data.startDate || null,
            endDate: data.endDate || null,
            status: data.status || "Actif",
            fullMonth: data.fullMonth !== undefined ? Boolean(data.fullMonth) : true,
            daysPerMonth: Number(data.daysPerMonth) || 0,
            monthlyCost: Number(data.monthlyCost) || 0,
            notes: data.notes || "",
            hasContract: false,
            hasNDA: false,
            driveFolderId: null, // Will be updated
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection("employees").insertOne(newEmployee);
        const employeeId = result.insertedId;

        // --- Drive Folder Creation Logic ---
        try {
            // 1. Ensure "Personnel" root folder exists
            let personnelRoot = await db.collection("drive_items").findOne({ name: "Personnel", type: "folder", parentId: null });
            if (!personnelRoot) {
                const rootDoc = {
                    type: "folder", name: "Personnel", parentId: null,
                    ext: "", mimeType: "", size: 0, storageName: "",
                    affiliatedContratId: null, affiliatedContratName: "",
                    createdAt: new Date(), updatedAt: new Date(),
                };
                const rootResult = await db.collection("drive_items").insertOne(rootDoc);
                personnelRoot = { _id: rootResult.insertedId };
            }

            // 2. Create Employee Folder
            const folderName = `${newEmployee.lastName}_${newEmployee.firstName}_${newEmployee.contractType}`.replace(/[^a-zA-Z0-9]/g, '_');
            const empFolderDoc = {
                type: "folder", name: folderName, parentId: personnelRoot._id,
                ext: "", mimeType: "", size: 0, storageName: "",
                affiliatedContratId: null, affiliatedContratName: "",
                createdAt: new Date(), updatedAt: new Date(),
            };
            const empFolderResult = await db.collection("drive_items").insertOne(empFolderDoc);

            // 3. Update employee with folder ID
            await db.collection("employees").updateOne(
                { _id: employeeId },
                { $set: { driveFolderId: String(empFolderResult.insertedId) } }
            );

            newEmployee.driveFolderId = String(empFolderResult.insertedId);
        } catch (driveErr) {
            console.error("Failed to create drive folders for new personnel", driveErr);
            // Non-blocking error, we still return the employee
        }

        return Response.json({ item: { _id: employeeId, ...newEmployee } });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
