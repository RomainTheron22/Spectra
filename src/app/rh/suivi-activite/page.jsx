"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./SuiviActivite.module.css";
import { authClient } from "../../../lib/auth-client";

function getMonthBoundaries(year, month) {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59);
    return { start, end };
}

function calculateWorkingDays(start, end) {
    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
        const day = cur.getDay();
        if (day !== 0 && day !== 6) count++;
        cur.setDate(cur.getDate() + 1);
    }
    return count;
}

export default function SuiviActivitePage() {
    const { data: session } = authClient.useSession(); // eslint-disable-line

    const [employees, setEmployees] = useState([]);
    const [absences, setAbsences] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

    useEffect(() => {
        loadData();
    }, [selectedYear, selectedMonth]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError("");

            const { start, end } = getMonthBoundaries(selectedYear, selectedMonth);

            const [empRes, absRes] = await Promise.all([
                fetch("/api/personnel"),
                fetch(`/api/absences?from=${start.toISOString()}&to=${end.toISOString()}`)
            ]);

            if (!empRes.ok || !absRes.ok) throw new Error("Erreur de chargement des données");

            const empData = await empRes.json();
            const absData = await absRes.json();

            setEmployees(empData.items || []);
            setAbsences(absData.items || []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const activityData = useMemo(() => {
        const { start, end } = getMonthBoundaries(selectedYear, selectedMonth);
        const totalWorkingDays = calculateWorkingDays(start, end);

        const data = employees.filter(e => e.status === "Actif").map(emp => {
            // Find absences for this employee in this month
            const empAbsences = absences.filter(a => a.employeeId === emp._id);

            let absDays = 0;
            empAbsences.forEach(abs => {
                const absStart = new Date(Math.max(new Date(abs.startDate).getTime(), start.getTime()));
                const absEnd = new Date(Math.min(new Date(abs.endDate).getTime(), end.getTime()));
                if (absStart <= absEnd) {
                    absDays += calculateWorkingDays(absStart, absEnd);
                }
            });

            const workedDays = Math.max(0, totalWorkingDays - absDays);
            const estCost = emp.monthlyCost ? emp.monthlyCost : (emp.dailyCost * workedDays);

            return {
                ...emp,
                workedDays,
                absDays,
                estCost
            };
        });

        return data.sort((a, b) => a.lastName.localeCompare(b.lastName));
    }, [employees, absences, selectedYear, selectedMonth]);

    const totalCost = activityData.reduce((acc, curr) => acc + (curr.estCost || 0), 0);
    const totalAbsences = activityData.reduce((acc, curr) => acc + curr.absDays, 0);

    const alerts = useMemo(() => {
        return employees.filter(e =>
            e.status === "Actif" &&
            (e.contractType?.toLowerCase() === "stagiaire" || e.contractType?.toLowerCase() === "alternant") &&
            (!e.hasContract || !e.hasNDA)
        );
    }, [employees]);

    return (
        <div className={styles.page}>
            <div className={styles.headerRow}>
                <h1 className={styles.pageTitle}>Suivi d&apos;Activité RH</h1>
            </div>

            <div className={styles.toolbar}>
                <select className={styles.select} value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                    {Array.from({ length: 12 }).map((_, i) => (
                        <option key={i} value={i}>{new Date(0, i).toLocaleString('fr-FR', { month: 'long' })}</option>
                    ))}
                </select>
                <select className={styles.select} value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                    {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            </div>

            {error && <div className={styles.errorBox}>{error}</div>}

            {alerts.length > 0 && (
                <div className={styles.alertBox}>
                    <h3 className={styles.alertTitle}>⚠️ Documents manquants (Alternants / Stagiaires)</h3>
                    <ul className={styles.alertList}>
                        {alerts.map(a => (
                            <li key={a._id}>
                                <strong>{a.firstName} {a.lastName}</strong> :
                                {!a.hasContract && " Contrat manquant"}
                                {!a.hasContract && !a.hasNDA && " —"}
                                {!a.hasNDA && " NDA manquant"}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statLabel}>Coût Estimé Équipe Base (Mois)</div>
                    <div className={styles.statValue}>{totalCost.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statLabel}>Total Jours d&apos;Absence</div>
                    <div className={styles.statValue}>{totalAbsences} jours</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statLabel}>Effectif Actif</div>
                    <div className={styles.statValue}>{activityData.length} membres</div>
                </div>
            </div>

            <div className={styles.card}>
                <h2 className={styles.cardTitle}>Détail par personne</h2>
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Membre</th>
                                <th>Pôle / Rôle</th>
                                <th>Contrat</th>
                                <th>Jours Travaillés</th>
                                <th>Jours Absents</th>
                                <th>Coût Estimé</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className={styles.emptyCell}>Chargement...</td></tr>
                            ) : activityData.length === 0 ? (
                                <tr><td colSpan={6} className={styles.emptyCell}>Aucune donnée pour ce mois.</td></tr>
                            ) : (
                                activityData.map(d => (
                                    <tr key={d._id}>
                                        <td><strong>{d.firstName} {d.lastName}</strong></td>
                                        <td>{d.pole} - {d.role}</td>
                                        <td>{d.contractType}</td>
                                        <td>{d.workedDays} j</td>
                                        <td style={{ color: d.absDays > 0 ? '#dc2626' : undefined }}>
                                            {d.absDays > 0 ? `${d.absDays} j` : '-'}
                                        </td>
                                        <td>{Number(d.estCost).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

const currentYear = new Date().getFullYear();
