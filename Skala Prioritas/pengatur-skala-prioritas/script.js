
// ============================================
// SKALA PRIORITAS TUGAS + SUPABASE GOOGLE LOGIN
// ============================================

// Ganti dengan URL dan publishable/anon key Supabase.
const SUPABASE_URL = "https://yuxgbmpzekxiccrqgbut.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-oT3Vbkt41nBu5C5t2bHjg_Pso62yUs";

const STORAGE_KEY = "skalaPrioritasTasks";

const hasSupabaseConfig =
    typeof SUPABASE_URL === "string" &&
    SUPABASE_URL.startsWith("https://") &&
    SUPABASE_ANON_KEY !==
        "MASUKKAN_PUBLISHABLE_ATAU_ANON_KEY_SUPABASE" &&
    SUPABASE_ANON_KEY.trim().length > 0;

if (!window.supabase || !hasSupabaseConfig) {
    console.error(
        "Konfigurasi Supabase belum lengkap. Isi SUPABASE_URL dan SUPABASE_ANON_KEY."
    );
}

const supabaseClient =
    window.supabase && hasSupabaseConfig
        ? window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        )
        : null;

// Membaca tugas yang sudah tersimpan di browser.
function readLocalTasks() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "[]"
        );

        if (!Array.isArray(saved)) return [];

        saved.forEach((task, index) => {
            if (typeof task.manualOrder !== "number") {
                task.manualOrder = index;
            }

            if (typeof task.archived !== "boolean") {
                task.archived = false;
            }

            if (task.id !== undefined && task.id !== null) {
                task.id = String(task.id);
            }
        });

        return saved;
    } catch (error) {
        console.error(
            "Gagal membaca tugas dari localStorage:",
            error
        );

        return [];
    }
}

let tasks = readLocalTasks();
let currentSort = "manual";
let currentUserId = null;
let cloudReady = false;
let authStateUserId = null;
let syncQueue = Promise.resolve();

// ============================================
// ELEMENT HTML
// ============================================

const loginSection = document.getElementById("loginSection");
const appContent = document.getElementById("appContent");
const googleLoginButton =
    document.getElementById("googleLoginButton");
const logoutButton = document.getElementById("logoutButton");
const userEmail = document.getElementById("userEmail");
const authStatus = document.getElementById("authStatus");

const taskForm = document.getElementById("taskForm");
const taskId = document.getElementById("taskId");
const taskName = document.getElementById("taskName");
const deadline = document.getElementById("deadline");
const weight = document.getElementById("weight");
const description = document.getElementById("description");

const taskList = document.getElementById("taskList");
const archiveList = document.getElementById("archiveList");
const emptyMessage = document.getElementById("emptyMessage");
const emptyArchive = document.getElementById("emptyArchive");

const totalTasks = document.getElementById("totalTasks");
const activeTasks = document.getElementById("activeTasks");
const archivedTasks = document.getElementById("archivedTasks");

const submitButton = document.getElementById("submitButton");
const cancelEdit = document.getElementById("cancelEdit");
const sortSelect = document.getElementById("sortSelect");

// ============================================
// STATUS LOGIN / CLOUD
// ============================================

function setAuthStatus(message, isError = false) {
    if (!authStatus) return;

    authStatus.textContent = message;
    authStatus.style.color = isError ? "#b42318" : "inherit";
}

function showLoggedOut() {
    currentUserId = null;
    cloudReady = false;
    tasks = readLocalTasks();

    if (loginSection) loginSection.hidden = false;
    if (appContent) appContent.hidden = true;
    if (logoutButton) logoutButton.hidden = true;
    if (googleLoginButton) googleLoginButton.disabled = false;
    if (userEmail) userEmail.textContent = "";

    setAuthStatus(
        supabaseClient
            ? "Masuk dengan Google untuk menyimpan tugas di cloud."
            : "Isi URL dan key Supabase di bagian atas script.js terlebih dahulu.",
        !supabaseClient
    );
}

async function handleAuthSession(session) {
    const user = session?.user;

    if (!user) {
        authStateUserId = null;
        showLoggedOut();
        return;
    }

    // Hindari memuat ulang sesi yang sama.
    if (authStateUserId === user.id && cloudReady) return;

    authStateUserId = user.id;
    currentUserId = user.id;
    cloudReady = false;

    if (loginSection) loginSection.hidden = true;
    if (appContent) appContent.hidden = false;
    if (logoutButton) logoutButton.hidden = false;

    if (userEmail) {
        userEmail.textContent = user.email || "Login berhasil";
    }

    setAuthStatus("Mengambil data tugas...");

    try {
        const { data: cloudRows, error } = await supabaseClient
            .from("tasks")
            .select(
                "id, name, deadline, weight, description, archived, position"
            )
            .eq("user_id", currentUserId)
            .order("position", { ascending: true });

        if (error) throw error;

        if (cloudRows && cloudRows.length > 0) {
            // Data cloud menjadi sumber utama untuk ID yang sudah ada.
            tasks = cloudRows.map((row, index) => ({
                id: String(row.id),
                name: row.name || "",
                deadline: row.deadline || "",
                weight: Number(row.weight ?? 50),
                description: row.description || "",
                archived: Boolean(row.archived),
                manualOrder: Number(row.position ?? index)
            }));

            // Pertahankan tugas lokal yang belum ada di cloud.
            const cloudIds = new Set(
                tasks.map(task => String(task.id))
            );

            const localOnlyTasks = readLocalTasks().filter(
                task => !cloudIds.has(String(task.id))
            );

            if (localOnlyTasks.length > 0) {
                let nextOrder = tasks.reduce(
                    (max, task) =>
                        Math.max(
                            max,
                            Number(task.manualOrder) || 0
                        ),
                    -1
                ) + 1;

                localOnlyTasks.forEach(task => {
                    task.manualOrder = nextOrder++;
                    tasks.push(task);
                });

                await writeTasksToCloud();
            }

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(tasks)
            );
        } else {
            // Cloud kosong: migrasikan tugas lama dari browser.
            tasks = readLocalTasks();

            if (tasks.length > 0) {
                await writeTasksToCloud();
            }
        }

        cloudReady = true;
        renderTasks();
        setAuthStatus("Tersinkron dengan Supabase.");
    } catch (error) {
        console.error(
            "Gagal memuat atau menyinkronkan tugas:",
            error
        );

        cloudReady = false;

        setAuthStatus(
            "Gagal mengakses cloud. Periksa tabel Supabase dan RLS.",
            true
        );

        // Tugas lokal tetap dipertahankan jika cloud gagal.
        tasks = readLocalTasks();
        renderTasks();
    }
}

// ============================================
// INISIALISASI LOGIN
// ============================================

if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange(
        (_event, session) => {
            // Jalankan setelah callback autentikasi selesai.
            setTimeout(() => {
                handleAuthSession(session);
            }, 0);
        }
    );

    supabaseClient.auth.getSession().then(
        ({ data, error }) => {
            if (error) {
                console.error(
                    "Gagal memeriksa sesi:",
                    error
                );

                setAuthStatus(
                    "Gagal memeriksa sesi login.",
                    true
                );

                return;
            }

            handleAuthSession(data.session);
        }
    );
} else {
    setAuthStatus(
        "Isi URL dan key Supabase di bagian atas script.js terlebih dahulu.",
        true
    );
}

// Login dengan Google.
if (googleLoginButton) {
    googleLoginButton.addEventListener(
        "click",
        async () => {
            if (!supabaseClient) {
                setAuthStatus(
                    "Isi konfigurasi Supabase terlebih dahulu.",
                    true
                );

                return;
            }

            googleLoginButton.disabled = true;
            setAuthStatus("Mengalihkan ke Google...");

            const { error } =
                await supabaseClient.auth.signInWithOAuth({
                    provider: "google",
                    options: {
                        redirectTo: window.location.origin
                    }
                });

            if (error) {
                console.error(
                    "Google login gagal:",
                    error
                );

                setAuthStatus(
                    "Login Google gagal: " + error.message,
                    true
                );

                googleLoginButton.disabled = false;
            }
        }
    );
}

// Logout.
if (logoutButton) {
    logoutButton.addEventListener(
        "click",
        async () => {
            if (!supabaseClient) return;

            const { error } =
                await supabaseClient.auth.signOut();

            if (error) {
                console.error(
                    "Logout gagal:",
                    error
                );

                setAuthStatus(
                    "Logout gagal: " + error.message,
                    true
                );
            }
        }
    );
}


// ============================================
// LOCAL STORAGE + SUPABASE SYNC
// ============================================

function saveTasks() {
    // Simpan salinan lokal.
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(tasks)
    );

    if (!cloudReady || !currentUserId || !supabaseClient) {
        return;
    }

    // Jaga urutan operasi sinkronisasi.
    syncQueue = syncQueue
        .then(() => writeTasksToCloud())
        .catch(error => {
            console.error(
                "Sinkronisasi tugas gagal:",
                error
            );

            setAuthStatus(
                "Perubahan tersimpan di browser, tetapi sinkronisasi cloud gagal.",
                true
            );
        });
}

async function writeTasksToCloud() {
    if (!currentUserId || !supabaseClient) return;

    const userIdForWrite = currentUserId;

    const snapshot = tasks.map((task, index) => ({
        user_id: userIdForWrite,
        id: String(task.id),
        name: task.name,
        deadline: task.deadline,
        weight: Number(task.weight),
        description: task.description || "",
        archived: Boolean(task.archived),
        position: Number(task.manualOrder ?? index)
    }));

    // Simpan atau perbarui tugas.
    if (snapshot.length > 0) {
        const { error: upsertError } =
            await supabaseClient
                .from("tasks")
                .upsert(snapshot, {
                    onConflict: "user_id,id"
                });

        if (upsertError) throw upsertError;
    }

    // Ambil ID tugas yang masih ada di cloud.
    const { data: cloudRows, error: fetchError } =
        await supabaseClient
            .from("tasks")
            .select("id")
            .eq("user_id", userIdForWrite);

    if (fetchError) throw fetchError;

    // Cari tugas cloud yang sudah dihapus dari daftar lokal.
    const currentIds = new Set(
        snapshot.map(task => task.id)
    );

    const staleIds = (cloudRows || [])
        .map(row => String(row.id))
        .filter(id => !currentIds.has(id));

    if (staleIds.length > 0) {
        const { error: deleteError } =
            await supabaseClient
                .from("tasks")
                .delete()
                .eq("user_id", userIdForWrite)
                .in("id", staleIds);

        if (deleteError) throw deleteError;
    }

    setAuthStatus("Tersinkron dengan Supabase.");
}

// ============================================
// CALCULATE PRIORITY
// ============================================

function calculatePriority(task) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deadlineDate = new Date(
        task.deadline + "T00:00:00"
    );

    const timeDifference =
        deadlineDate.getTime() - today.getTime();

    const daysRemaining = Math.ceil(
        timeDifference / (1000 * 60 * 60 * 24)
    );

    let deadlineScore;

    if (daysRemaining <= 0) {
        deadlineScore = 100;
    } else {
        deadlineScore = Math.max(
            0,
            100 - (daysRemaining / 30 * 100)
        );
    }

    const weightScore = Number(task.weight);

    // 50% bobot dan 50% deadline.
    return (
        (weightScore * 0.5) +
        (deadlineScore * 0.5)
    );
}

// ============================================
// RENDER TASKS
// ============================================

function renderTasks() {
    if (!taskList || !archiveList) return;

    taskList.innerHTML = "";
    archiveList.innerHTML = "";

    const active = tasks.filter(
        task => !task.archived
    );

    const archived = tasks.filter(
        task => task.archived
    );

    // Pengurutan tugas aktif.
    active.sort((a, b) => {
        if (currentSort === "manual") {
            return (
                Number(a.manualOrder) -
                Number(b.manualOrder)
            );
        }

        if (currentSort === "deadline-asc") {
            return (
                new Date(a.deadline) -
                new Date(b.deadline)
            );
        }

        if (currentSort === "deadline-desc") {
            return (
                new Date(b.deadline) -
                new Date(a.deadline)
            );
        }

        if (currentSort === "weight-desc") {
            return (
                Number(b.weight) -
                Number(a.weight)
            );
        }

        if (currentSort === "weight-asc") {
            return (
                Number(a.weight) -
                Number(b.weight)
            );
        }

        if (currentSort === "priority") {
            return (
                calculatePriority(b) -
                calculatePriority(a)
            );
        }

        return 0;
    });

    // Statistik.
    totalTasks.textContent = tasks.length;
    activeTasks.textContent = active.length;
    archivedTasks.textContent = archived.length;

    // Pesan saat daftar kosong.
    emptyMessage.style.display =
        active.length === 0 ? "block" : "none";

    emptyArchive.style.display =
        archived.length === 0 ? "block" : "none";

    // Tugas aktif.
    active.forEach((task, index) => {
        taskList.appendChild(
            createTaskCard(task, index, false)
        );
    });

    // Tugas arsip.
    archived.forEach(task => {
        archiveList.appendChild(
            createTaskCard(task, null, true)
        );
    });
}

// ============================================
// CREATE TASK CARD
// ============================================

function createTaskCard(task, index, isArchived) {
    const card = document.createElement("div");

    // Warna berdasarkan bobot.
    let priorityClass = "priority-low";

    if (Number(task.weight) >= 70) {
        priorityClass = "priority-high";
    } else if (Number(task.weight) >= 40) {
        priorityClass = "priority-medium";
    }

    card.className =
        `task-card ${priorityClass} ${
            isArchived ? "archived" : ""
        }`;

    // Periksa deadline.
    const overdue = isOverdue(task.deadline);

    const overdueWarning =
        overdue && !isArchived
            ? `<span class="overdue-warning">Melebihi Deadline</span>`
            : "";

    // Amankan ID untuk digunakan dalam event handler.
    const safeId = JSON.stringify(
        String(task.id)
    ).replace(/</g, "\\u003c");

    card.innerHTML = `
        <div class="task-top">
            <div>
                <div class="task-title">
                    ${escapeHTML(task.name)}
                    ${overdueWarning}
                </div>

                ${
                    task.description
                        ? `
                            <div class="task-description">
                                ${escapeHTML(task.description)}
                            </div>
                        `
                        : ""
                }
            </div>

            ${
                !isArchived
                    ? `
                        <div class="move-buttons">
                            <button
                                type="button"
                                aria-label="Pindahkan tugas ke atas"
                                onclick="moveTask(${safeId}, -1)"
                            >
                                ↑
                            </button>

                            <button
                                type="button"
                                aria-label="Pindahkan tugas ke bawah"
                                onclick="moveTask(${safeId}, 1)"
                            >
                                ↓
                            </button>
                        </div>
                    `
                    : ""
            }
        </div>

        <div class="task-info">
            <span class="badge badge-weight">
                Bobot: ${Number(task.weight)}%
            </span>

            <span class="badge ${
                overdue ? "badge-overdue" : "badge-deadline"
            }">
                Deadline: ${formatDate(task.deadline)}
            </span>

            ${
                overdue && !isArchived
                    ? `
                        <span class="badge badge-overdue">
                            Terlambat
                        </span>
                    `
                    : ""
            }
        </div>

        <div class="task-actions">
            ${
                !isArchived
                    ? `
                        <button
                            type="button"
                            class="btn btn-secondary"
                            onclick="editTask(${safeId})"
                        >
                            Edit
                        </button>

                        <button
                            type="button"
                            class="btn btn-archive"
                            onclick="archiveTask(${safeId})"
                        >
                            Arsipkan
                        </button>
                    `
                    : `
                        <button
                            type="button"
                            class="btn btn-success"
                            onclick="unarchiveTask(${safeId})"
                        >
                            Kembalikan
                        </button>
                    `
            }

            <button
                type="button"
                class="btn btn-danger"
                onclick="deleteTask(${safeId})"
            >
                Hapus
            </button>
        </div>
    `;

    return card;
}


// ============================================
// ADD / EDIT TASK
// ============================================

taskForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const nameValue = taskName.value.trim();
    const deadlineValue = deadline.value;
    const weightValue = Number(weight.value);
    const descriptionValue = description.value.trim();

    if (!nameValue || !deadlineValue) return;

    if (
        !Number.isFinite(weightValue) ||
        weightValue < 1 ||
        weightValue > 100
    ) {
        alert("Bobot harus berada di antara 1 sampai 100.");
        return;
    }

    // Edit tugas yang sudah ada.
    if (taskId.value) {
        const task = tasks.find(
            item => String(item.id) === String(taskId.value)
        );

        if (task) {
            task.name = nameValue;
            task.deadline = deadlineValue;
            task.weight = weightValue;
            task.description = descriptionValue;
        }
    } else {
        // Tambah tugas baru.
        const newTask = {
            id: Date.now().toString(),

            manualOrder: tasks.reduce(
                (max, task) =>
                    Math.max(
                        max,
                        Number(task.manualOrder) || 0
                    ),
                -1
            ) + 1,

            name: nameValue,
            deadline: deadlineValue,
            weight: weightValue,
            description: descriptionValue,
            archived: false
        };

        tasks.push(newTask);
    }

    saveTasks();
    renderTasks();
    resetForm();
}

// ============================================
// EDIT TASK
// ============================================

function editTask(id) {
    const task = tasks.find(
        item => String(item.id) === String(id)
    );

    if (!task) return;

    taskId.value = task.id;
    taskName.value = task.name;
    deadline.value = task.deadline;
    weight.value = task.weight;
    description.value = task.description || "";

    submitButton.textContent = "Simpan Perubahan";

    cancelEdit.classList.remove("hidden");

    document.getElementById("formTitle").textContent =
        "Edit Tugas";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

// ============================================
// CANCEL EDIT
// ============================================

cancelEdit.addEventListener("click", resetForm);

function resetForm() {
    taskForm.reset();

    taskId.value = "";
    weight.value = 50;

    submitButton.textContent = "Tambah Tugas";

    cancelEdit.classList.add("hidden");

    document.getElementById("formTitle").textContent =
        "Tambah Tugas";
}

// ============================================
// DELETE TASK
// ============================================

function deleteTask(id) {
    const confirmed = confirm(
        "Apakah Anda yakin ingin menghapus tugas ini?"
    );

    if (!confirmed) return;

    tasks = tasks.filter(
        task => String(task.id) !== String(id)
    );

    saveTasks();
    renderTasks();
}

// ============================================
// ARCHIVE TASK
// ============================================

function archiveTask(id) {
    const task = tasks.find(
        item => String(item.id) === String(id)
    );

    if (!task) return;

    task.archived = true;

    saveTasks();
    renderTasks();
}

// ============================================
// UNARCHIVE TASK
// ============================================

function unarchiveTask(id) {
    const task = tasks.find(
        item => String(item.id) === String(id)
    );

    if (!task) return;

    task.archived = false;

    saveTasks();
    renderTasks();
}

// ============================================
// MOVE TASK / MANUAL ORDER
// ============================================

function moveTask(id, direction) {
    const activeTasksArray = tasks
        .filter(task => !task.archived)
        .sort(
            (a, b) =>
                Number(a.manualOrder) -
                Number(b.manualOrder)
        );

    const currentIndex = activeTasksArray.findIndex(
        task => String(task.id) === String(id)
    );

    const newIndex = currentIndex + direction;

    if (
        currentIndex < 0 ||
        newIndex < 0 ||
        newIndex >= activeTasksArray.length
    ) {
        return;
    }

    const currentTask = activeTasksArray[currentIndex];
    const targetTask = activeTasksArray[newIndex];

    // Tukar urutan kedua tugas.
    const tempOrder = currentTask.manualOrder;

    currentTask.manualOrder = targetTask.manualOrder;
    targetTask.manualOrder = tempOrder;

    // Kembali ke mode manual.
    currentSort = "manual";
    sortSelect.value = "manual";

    saveTasks();
    renderTasks();
}

// ============================================
// SORT
// ============================================

sortSelect.addEventListener("change", function () {
    currentSort = sortSelect.value;
    renderTasks();
});

// ============================================
// FORMAT DATE
// ============================================

function formatDate(dateString) {
    if (!dateString) return "-";

    const date = new Date(
        dateString + "T00:00:00"
    );

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

// ============================================
// CHECK OVERDUE
// ============================================

function isOverdue(dateString) {
    if (!dateString) return false;

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const deadlineDate = new Date(
        dateString + "T00:00:00"
    );

    return (
        !Number.isNaN(deadlineDate.getTime()) &&
        deadlineDate < today
    );
}

// ============================================
// SECURITY: ESCAPE HTML
// ============================================

function escapeHTML(value) {
    const div = document.createElement("div");

    div.textContent =
        value == null ? "" : String(value);

    return div.innerHTML;
}

// Daftar tugas dirender setelah sesi login dan data cloud dimuat.
// Saat logout, aplikasi disembunyikan dan data lokal tetap dipertahankan.
