
/* =========================================
   KONFIGURASI SUPABASE
========================================= */

const SUPABASE_URL =
    "https://yuxgbmpzekxiccrqgbut.supabase.co";

const SUPABASE_ANON_KEY =
    "sb_publishable_-oT3Vbkt41nBu5C5t2bHjg_Pso62yUs";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


/* =========================================
   VARIABEL APLIKASI
========================================= */

let tasks = [];
let currentUser = null;
let currentSort = "manual";
let isSaving = false;

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
const formTitle = document.getElementById("formTitle");

const loginSection = document.getElementById("loginSection");
const appContent = document.getElementById("appContent");
const googleLoginButton = document.getElementById("googleLoginButton");
const logoutButton = document.getElementById("logoutButton");
const authStatus = document.getElementById("authStatus");
const userEmail = document.getElementById("userEmail");


/* =========================================
   LOGIN GOOGLE
========================================= */

googleLoginButton.addEventListener("click", async () => {
    try {
        googleLoginButton.disabled = true;
        authStatus.textContent = "Menghubungkan ke Google...";

        const { error } =
            await supabaseClient.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: window.location.origin
                }
            });

        if (error) {
            throw error;
        }
    } catch (error) {
        console.error("Login Google gagal:", error);

        authStatus.textContent =
            "Login gagal: " + error.message;

        googleLoginButton.disabled = false;
    }
});


/* =========================================
   LOGOUT
========================================= */

logoutButton.addEventListener("click", async () => {
    try {
        logoutButton.disabled = true;

        const { error } =
            await supabaseClient.auth.signOut();

        if (error) {
            throw error;
        }
    } catch (error) {
        console.error("Logout gagal:", error);
        alert("Gagal keluar: " + error.message);
    } finally {
        logoutButton.disabled = false;
    }
});


/* =========================================
   STATUS AUTENTIKASI
========================================= */

let authRequestNumber = 0;

async function handleSession(session) {
    const requestNumber = ++authRequestNumber;

    currentUser = session?.user ?? null;

    if (!currentUser) {
        tasks = [];

        loginSection.hidden = false;
        appContent.hidden = true;
        logoutButton.hidden = true;
        userEmail.textContent = "";

        authStatus.textContent =
            "Silakan login menggunakan akun Google.";

        googleLoginButton.disabled = false;
        renderTasks();

        return;
    }

    loginSection.hidden = true;
    appContent.hidden = false;
    logoutButton.hidden = false;
    userEmail.textContent =
        currentUser.email || "Pengguna login";

    try {
        await loadTasks();

        // Abaikan hasil lama jika sesi berubah saat data dimuat.
        if (requestNumber !== authRequestNumber) {
            return;
        }

        renderTasks();
    } catch (error) {
        console.error("Gagal memuat tugas:", error);

        authStatus.textContent =
            "Gagal memuat tugas. Periksa koneksi dan pengaturan Supabase.";

        alert(
            "Data tugas gagal dimuat: " + error.message
        );
    }
}


/* =========================================
   MEMUAT TUGAS DARI SUPABASE
========================================= */

async function loadTasks() {
    if (!currentUser) {
        tasks = [];
        return;
    }

    const { data, error } = await supabaseClient
        .from("tasks")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("position", { ascending: true });

    if (error) {
        throw error;
    }

    tasks = (data || []).map((row, index) => ({
        id: row.id,
        name: row.name,
        deadline: row.deadline,
        weight: Number(row.weight),
        description: row.description || "",
        archived: Boolean(row.archived),
        manualOrder: Number(row.position ?? index),
        created_at: row.created_at
    }));
}


/* =========================================
   MENYIMPAN SATU TUGAS KE SUPABASE
========================================= */

async function saveTaskToCloud(task) {
    if (!currentUser) {
        throw new Error("Silakan login terlebih dahulu.");
    }

    const row = {
        user_id: currentUser.id,
        id: String(task.id),
        name: task.name,
        deadline: task.deadline,
        weight: Number(task.weight),
        description: task.description || "",
        archived: Boolean(task.archived),
        position: Number(task.manualOrder ?? 0)
    };

    const { error } = await supabaseClient
        .from("tasks")
        .upsert(row, {
            onConflict: "user_id,id"
        });

    if (error) {
        throw error;
    }
}


/* =========================================
   MENYIMPAN URUTAN SEMUA TUGAS
========================================= */

async function saveAllPositions() {
    if (!currentUser) {
        throw new Error("Silakan login terlebih dahulu.");
    }

    const rows = tasks.map((task, index) => ({
        user_id: currentUser.id,
        id: String(task.id),
        name: task.name,
        deadline: task.deadline,
        weight: Number(task.weight),
        description: task.description || "",
        archived: Boolean(task.archived),
        position: Number(task.manualOrder ?? index)
    }));

    if (rows.length === 0) {
        return;
    }

    const { error } = await supabaseClient
        .from("tasks")
        .upsert(rows, {
            onConflict: "user_id,id"
        });

    if (error) {
        throw error;
    }
}


/* =========================================
   MENGHAPUS TUGAS DARI SUPABASE
========================================= */

async function deleteTaskFromCloud(id) {
    if (!currentUser) {
        throw new Error("Silakan login terlebih dahulu.");
    }

    const { error } = await supabaseClient
        .from("tasks")
        .delete()
        .eq("user_id", currentUser.id)
        .eq("id", String(id));

    if (error) {
        throw error;
    }
}


/* =========================================
   HITUNG PRIORITAS GABUNGAN
   50% bobot + 50% urgensi deadline
========================================= */

function calculatePriority(task) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deadlineDate = new Date(
        task.deadline + "T00:00:00"
    );

    const daysRemaining = Math.ceil(
        (deadlineDate.getTime() - today.getTime()) /
        (1000 * 60 * 60 * 24)
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

    return (
        weightScore * 0.5 +
        deadlineScore * 0.5
    );
}


/* =========================================
   MEMERIKSA DEADLINE
========================================= */

function isOverdue(dateString) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deadlineDate = new Date(
        dateString + "T00:00:00"
    );

    return deadlineDate < today;
}


function formatDate(dateString) {
    const date = new Date(
        dateString + "T00:00:00"
    );

    return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}


/* =========================================
   KEAMANAN TEKS HTML
========================================= */

function escapeHTML(value) {
    const element = document.createElement("div");
    element.textContent = String(value ?? "");
    return element.innerHTML;
}


/* =========================================
   MENAMPILKAN TUGAS
========================================= */

function renderTasks() {
    taskList.innerHTML = "";
    archiveList.innerHTML = "";

    const active = tasks
        .filter(task => !task.archived)
        .slice();

    const archived = tasks
        .filter(task => task.archived)
        .slice();

    active.sort((a, b) => {
        switch (currentSort) {
            case "deadline-asc":
                return a.deadline.localeCompare(b.deadline);

            case "deadline-desc":
                return b.deadline.localeCompare(a.deadline);

            case "weight-desc":
                return Number(b.weight) - Number(a.weight);

            case "weight-asc":
                return Number(a.weight) - Number(b.weight);

            case "priority":
                return calculatePriority(b) - calculatePriority(a);

            case "manual":
            default:
                return Number(a.manualOrder) - Number(b.manualOrder);
        }
    });

    totalTasks.textContent = tasks.length;
    activeTasks.textContent = active.length;
    archivedTasks.textContent = archived.length;

    emptyMessage.style.display =
        active.length === 0 ? "block" : "none";

    emptyArchive.style.display =
        archived.length === 0 ? "block" : "none";

    active.forEach((task, index) => {
        taskList.appendChild(
            createTaskCard(task, index, false)
        );
    });

    archived.forEach(task => {
        archiveList.appendChild(
            createTaskCard(task, null, true)
        );
    });
}


/* =========================================
   MEMBUAT KARTU TUGAS
========================================= */

function createTaskCard(task, index, isArchived) {
    const card = document.createElement("div");

    let priorityClass = "priority-low";

    if (Number(task.weight) >= 70) {
        priorityClass = "priority-high";
    } else if (Number(task.weight) >= 40) {
        priorityClass = "priority-medium";
    }

    card.className =
        "task-card " +
        priorityClass +
        (isArchived ? " archived" : "");

    const overdue = isOverdue(task.deadline);

    const overdueWarning =
        overdue && !isArchived
            ? `<span class="overdue-warning">Melebihi Deadline</span>`
            : "";

    const moveButtons = !isArchived
        ? `
            <div class="move-buttons">
                <button type="button" data-action="move-up"
                    data-id="${escapeHTML(task.id)}"
                    aria-label="Pindahkan tugas ke atas">↑</button>

                <button type="button" data-action="move-down"
                    data-id="${escapeHTML(task.id)}"
                    aria-label="Pindahkan tugas ke bawah">↓</button>
            </div>
        `
        : "";

    const actions = !isArchived
        ? `
            <button type="button" class="btn btn-secondary"
                data-action="edit" data-id="${escapeHTML(task.id)}">
                Edit
            </button>

            <button type="button" class="btn btn-archive"
                data-action="archive" data-id="${escapeHTML(task.id)}">
                Arsipkan
            </button>
        `
        : `
            <button type="button" class="btn btn-success"
                data-action="unarchive" data-id="${escapeHTML(task.id)}">
                Kembalikan
            </button>
        `;

    card.innerHTML = `
        <div class="task-top">
            <div>
                <div class="task-title">
                    ${escapeHTML(task.name)}
                    ${overdueWarning}
                </div>

                ${
                    task.description
                        ? `<div class="task-description">
                            ${escapeHTML(task.description)}
                           </div>`
                        : ""
                }
            </div>

            ${moveButtons}
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
                    ? `<span class="badge badge-overdue">Terlambat</span>`
                    : ""
            }
        </div>

        <div class="task-actions">
            ${actions}

            <button type="button" class="btn btn-danger"
                data-action="delete" data-id="${escapeHTML(task.id)}">
                Hapus
            </button>
        </div>
    `;

    return card;
}


/* =========================================
   TAMBAH / EDIT TUGAS
========================================= */

taskForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (isSaving) return;

    if (!currentUser) {
        alert("Silakan login terlebih dahulu.");
        return;
    }

    const nameValue = taskName.value.trim();
    const deadlineValue = deadline.value;
    const weightValue = Number(weight.value);
    const descriptionValue = description.value.trim();

    if (!nameValue || !deadlineValue) {
        alert("Nama tugas dan deadline wajib diisi.");
        return;
    }

    if (
        !Number.isFinite(weightValue) ||
        weightValue < 1 ||
        weightValue > 100
    ) {
        alert("Bobot harus antara 1 sampai 100.");
        return;
    }

    isSaving = true;
    submitButton.disabled = true;

    try {
        let task;

        if (taskId.value) {
            task = tasks.find(
                item => String(item.id) === String(taskId.value)
            );

            if (!task) {
                throw new Error("Tugas yang ingin diedit tidak ditemukan.");
            }

            task.name = nameValue;
            task.deadline = deadlineValue;
            task.weight = weightValue;
            task.description = descriptionValue;
        } else {
            const maxOrder = tasks.reduce(
                (max, item) => Math.max(
                    max,
                    Number(item.manualOrder) || 0
                ),
                -1
            );

            task = {
                id: crypto.randomUUID
                    ? crypto.randomUUID()
                    : Date.now().toString(),
                name: nameValue,
                deadline: deadlineValue,
                weight: weightValue,
                description: descriptionValue,
                archived: false,
                manualOrder: maxOrder + 1
            };

            tasks.push(task);
        }

        await saveTaskToCloud(task);

        resetForm();
        renderTasks();
    } catch (error) {
        console.error("Gagal menyimpan tugas:", error);

        alert(
            "Tugas gagal disimpan ke Supabase: " +
            error.message
        );

        // Muat ulang data server agar tampilan kembali konsisten.
        try {
            await loadTasks();
            renderTasks();
        } catch (reloadError) {
            console.error("Gagal memuat ulang tugas:", reloadError);
        }
    } finally {
        isSaving = false;
        submitButton.disabled = false;
    }
});


/* =========================================
   RESET FORM
========================================= */

function resetForm() {
    taskForm.reset();
    taskId.value = "";
    weight.value = 50;

    formTitle.textContent = "Tambah Tugas";
    submitButton.textContent = "Tambah Tugas";
    cancelEdit.classList.add("hidden");
}


/* =========================================
   EDIT TUGAS
========================================= */

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

    formTitle.textContent = "Edit Tugas";
    submitButton.textContent = "Simpan Perubahan";
    cancelEdit.classList.remove("hidden");

    taskForm.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


cancelEdit.addEventListener("click", resetForm);


/* =========================================
   AKSI KARTU TUGAS
========================================= */

async function handleTaskAction(action, id) {
    const task = tasks.find(
        item => String(item.id) === String(id)
    );

    if (!task) return;

    try {
        if (action === "edit") {
            editTask(id);
            return;
        }

        if (action === "delete") {
            const confirmed = confirm(
                `Hapus tugas "${task.name}"?`
            );

            if (!confirmed) return;

            await deleteTaskFromCloud(id);

            tasks = tasks.filter(
                item => String(item.id) !== String(id)
            );

            renderTasks();
            return;
        }

        if (action === "archive") {
            task.archived = true;
            await saveTaskToCloud(task);
            renderTasks();
            return;
        }

        if (action === "unarchive") {
            task.archived = false;
            await saveTaskToCloud(task);
            renderTasks();
            return;
        }

        if (action === "move-up" || action === "move-down") {
            const active = tasks
                .filter(item => !item.archived)
                .sort((a, b) =>
                    Number(a.manualOrder) - Number(b.manualOrder)
                );

            const currentIndex = active.findIndex(
                item => String(item.id) === String(id)
            );

            const direction = action === "move-up" ? -1 : 1;
            const newIndex = currentIndex + direction;

            if (newIndex < 0 || newIndex >= active.length) {
                return;
            }

            const currentTask = active[currentIndex];
            const targetTask = active[newIndex];

            const temp = currentTask.manualOrder;
            currentTask.manualOrder = targetTask.manualOrder;
            targetTask.manualOrder = temp;

            currentSort = "manual";
            sortSelect.value = "manual";

            await saveAllPositions();
            renderTasks();
        }
    } catch (error) {
        console.error("Aksi tugas gagal:", error);

        alert(
            "Perubahan gagal disimpan: " + error.message
        );

        try {
            await loadTasks();
            renderTasks();
        } catch (reloadError) {
            console.error("Gagal memuat ulang tugas:", reloadError);
        }
    }
}


taskList.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    handleTaskAction(
        button.dataset.action,
        button.dataset.id
    );
});


archiveList.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    handleTaskAction(
        button.dataset.action,
        button.dataset.id
    );
});


/* =========================================
   PENGURUTAN
========================================= */

sortSelect.addEventListener("change", () => {
    currentSort = sortSelect.value;
    renderTasks();
});


/* =========================================
   INISIALISASI SESI
========================================= */

supabaseClient.auth.onAuthStateChange(
    (_event, session) => {
        // Jalankan di luar callback autentikasi untuk menghindari
        // konflik ketika melakukan permintaan Supabase berikutnya.
        queueMicrotask(() => {
            handleSession(session);
        });
    }
);


// Periksa sesi yang sudah ada saat halaman dibuka.
(async function initializeAuth() {
    try {
        const { data, error } =
            await supabaseClient.auth.getSession();

        if (error) throw error;

        await handleSession(data.session);
    } catch (error) {
        console.error("Gagal memeriksa sesi:", error);

        authStatus.textContent =
            "Tidak dapat memeriksa sesi. Muat ulang halaman atau periksa konfigurasi Supabase.";

        googleLoginButton.disabled = false;
    }
})();
