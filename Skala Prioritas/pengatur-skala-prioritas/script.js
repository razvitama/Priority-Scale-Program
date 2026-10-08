const STORAGE_KEY = "skalaPrioritasTasks";

let tasks = JSON.parse(
    localStorage.getItem(STORAGE_KEY)
) || [];

// Menyimpan urutan manual secara terpisah
// dari hasil sorting.
tasks.forEach((task, index) => {

    if (typeof task.manualOrder !== "number") {
        task.manualOrder = index;
    }

});

let currentSort = "manual";


// ================================
// ELEMENT
// ================================

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


// ================================
// SAVE LOCAL STORAGE
// ================================

function saveTasks() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(tasks)
    );

}


// ================================
// CALCULATE PRIORITY
// ================================

function calculatePriority(task) {

    const today = new Date();

    today.setHours(0, 0, 0, 0);


    const deadlineDate = new Date(
        task.deadline + "T00:00:00"
    );


    // Selisih waktu dalam hari
    const timeDifference =
        deadlineDate.getTime() -
        today.getTime();


    const daysRemaining =
        Math.ceil(
            timeDifference /
            (1000 * 60 * 60 * 24)
        );


    /*
        Jika deadline sudah lewat,
        berikan nilai urgensi maksimum.
    */
    let deadlineScore;


    if (daysRemaining <= 0) {

        deadlineScore = 100;

    }
    else {

        /*
            Semakin dekat deadline,
            semakin tinggi nilainya.

            30 hari atau lebih = 0
            0 hari = 100
        */

        deadlineScore =
            Math.max(
                0,
                100 - (daysRemaining / 30 * 100)
            );

    }


    // Bobot sudah berada pada rentang 1-100.
    const weightScore =
        Number(task.weight);


    /*
        Prioritas akhir:

        50% Bobot
        50% Deadline
    */
    const priorityScore =
        (weightScore * 0.5) +
        (deadlineScore * 0.5);


    return priorityScore;

}


// ================================
// RENDER
// ================================

function renderTasks() {

    taskList.innerHTML = "";
    archiveList.innerHTML = "";


    let active =
        tasks.filter(
            task => !task.archived
        );


    const archived =
        tasks.filter(
            task => task.archived
        );


    // ================================
    // SORT
    // ================================

    active.sort((a, b) => {

        // Manual
        if (currentSort === "manual") {

            return (
                Number(a.manualOrder) -
                Number(b.manualOrder)
            );

        }


        // Deadline terdekat
        if (currentSort === "deadline-asc") {

            return (
                new Date(a.deadline) -
                new Date(b.deadline)
            );

        }


        // Deadline terjauh
        if (currentSort === "deadline-desc") {

            return (
                new Date(b.deadline) -
                new Date(a.deadline)
            );

        }


        // Bobot tertinggi
        if (currentSort === "weight-desc") {

            return (
                Number(b.weight) -
                Number(a.weight)
            );

        }


        // Bobot terendah
        if (currentSort === "weight-asc") {

            return (
                Number(a.weight) -
                Number(b.weight)
            );

        }


        // Prioritas gabungan
        if (currentSort === "priority") {

            return (
                calculatePriority(b) -
                calculatePriority(a)
            );

        }


        return 0;

    });


    // ================================
    // STATISTICS
    // ================================

    totalTasks.textContent =
        tasks.length;

    activeTasks.textContent =
        active.length;

    archivedTasks.textContent =
        archived.length;


    // ================================
    // EMPTY MESSAGE
    // ================================

    emptyMessage.style.display =
        active.length === 0
        ? "block"
        : "none";


    emptyArchive.style.display =
        archived.length === 0
        ? "block"
        : "none";


    // ================================
    // ACTIVE TASKS
    // ================================

    active.forEach(
        (task, index) => {

            taskList.appendChild(
                createTaskCard(
                    task,
                    index,
                    false
                )
            );

        }
    );


    // ================================
    // ARCHIVED TASKS
    // ================================

    archived.forEach(
        task => {

            archiveList.appendChild(
                createTaskCard(
                    task,
                    null,
                    true
                )
            );

        }
    );

}


// ================================
// CREATE TASK CARD
// ================================

function createTaskCard(
    task,
    index,
    isArchived
) {

    const card =
        document.createElement("div");


    // ================================
    // PRIORITY COLOR
    // ================================

    let priorityClass =
        "priority-low";


    if (task.weight >= 70) {

        priorityClass =
            "priority-high";

    }
    else if (task.weight >= 40) {

        priorityClass =
            "priority-medium";

    }


    card.className =
        `task-card ${priorityClass} ${
            isArchived
            ? "archived"
            : ""
        }`;


    // ================================
    // CHECK DEADLINE
    // ================================

    const overdue =
        isOverdue(task.deadline);


    // ================================
    // OVERDUE WARNING
    // ================================

    const overdueWarning =
        overdue && !isArchived
        ? `
            <span class="overdue-warning">
                Melebihi Deadline
            </span>
        `
        : "";


    // ================================
    // TASK CARD
    // ================================

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
                            ${escapeHTML(
                                task.description
                            )}
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
                            onclick="
                                moveTask(
                                    '${task.id}',
                                    -1
                                )
                            "
                        >
                            ↑
                        </button>

                        <button
                            onclick="
                                moveTask(
                                    '${task.id}',
                                    1
                                )
                            "
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
                Bobot: ${task.weight}%
            </span>


            <span class="
                badge
                ${
                    overdue
                    ? "badge-overdue"
                    : "badge-deadline"
                }
            ">

                Deadline:
                ${formatDate(task.deadline)}

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
                        class="btn btn-secondary"
                        onclick="
                            editTask(
                                '${task.id}'
                            )
                        "
                    >
                        Edit
                    </button>


                    <button
                        class="btn btn-archive"
                        onclick="
                            archiveTask(
                                '${task.id}'
                            )
                        "
                    >
                        Arsipkan
                    </button>
                `
                : `
                    <button
                        class="btn btn-success"
                        onclick="
                            unarchiveTask(
                                '${task.id}'
                            )
                        "
                    >
                        Kembalikan
                    </button>
                `
            }


            <button
                class="btn btn-danger"
                onclick="
                    deleteTask(
                        '${task.id}'
                    )
                "
            >
                Hapus
            </button>

        </div>

    `;


    return card;

}


// ================================
// ADD / EDIT TASK
// ================================

taskForm.addEventListener(
    "submit",
    function(event) {

        event.preventDefault();


        const nameValue =
            taskName.value.trim();


        const deadlineValue =
            deadline.value;


        const weightValue =
            Number(weight.value);


        const descriptionValue =
            description.value.trim();


        if (
            !nameValue ||
            !deadlineValue
        ) {

            return;

        }


        // ================================
        // EDIT
        // ================================

        if (taskId.value) {

            const task =
                tasks.find(
                    item =>
                        item.id ===
                        taskId.value
                );


            if (task) {

                task.name =
                    nameValue;

                task.deadline =
                    deadlineValue;

                task.weight =
                    weightValue;

                task.description =
                    descriptionValue;

            }

        }


        // ================================
        // TAMBAH
        // ================================

        else {

            const newTask = {

                id:
                    Date.now().toString(),


                manualOrder:
                    tasks.reduce(
                        (
                            max,
                            task
                        ) => {

                            return Math.max(
                                max,
                                Number(
                                    task.manualOrder
                                ) || 0
                            );

                        },
                        -1
                    ) + 1,


                name:
                    nameValue,


                deadline:
                    deadlineValue,


                weight:
                    weightValue,


                description:
                    descriptionValue,


                archived:
                    false

            };


            tasks.push(
                newTask
            );

        }


        saveTasks();

        renderTasks();

        resetForm();

    }
);


// ================================
// EDIT
// ================================

function editTask(id) {

    const task =
        tasks.find(
            item => item.id === id
        );


    if (!task) {

        return;

    }


    taskId.value =
        task.id;


    taskName.value =
        task.name;


    deadline.value =
        task.deadline;


    weight.value =
        task.weight;


    description.value =
        task.description;


    submitButton.textContent =
        "Simpan Perubahan";


    cancelEdit.classList.remove(
        "hidden"
    );


    document
        .getElementById("formTitle")
        .textContent =
        "Edit Tugas";


    window.scrollTo({

        top: 0,

        behavior: "smooth"

    });

}


// ================================
// CANCEL EDIT
// ================================

cancelEdit.addEventListener(
    "click",
    resetForm
);


function resetForm() {

    taskForm.reset();


    taskId.value =
        "";


    weight.value =
        50;


    submitButton.textContent =
        "Tambah Tugas";


    cancelEdit.classList.add(
        "hidden"
    );


    document
        .getElementById("formTitle")
        .textContent =
        "Tambah Tugas";

}


// ================================
// DELETE
// ================================

function deleteTask(id) {

    const confirmed =
        confirm(
            "Apakah Anda yakin ingin menghapus tugas ini?"
        );


    if (!confirmed) {

        return;

    }


    tasks =
        tasks.filter(
            task =>
                task.id !== id
        );


    saveTasks();

    renderTasks();

}


// ================================
// ARCHIVE
// ================================

function archiveTask(id) {

    const task =
        tasks.find(
            item => item.id === id
        );


    if (!task) {

        return;

    }


    task.archived =
        true;


    saveTasks();

    renderTasks();

}


// ================================
// UNARCHIVE
// ================================

function unarchiveTask(id) {

    const task =
        tasks.find(
            item => item.id === id
        );


    if (!task) {

        return;

    }


    task.archived =
        false;


    saveTasks();

    renderTasks();

}


// ================================
// MOVE TASK
// ================================

function moveTask(
    id,
    direction
) {

    const activeTasksArray =
        tasks
            .filter(
                task =>
                    !task.archived
            )
            .sort(
                (a, b) =>
                    Number(
                        a.manualOrder
                    ) -
                    Number(
                        b.manualOrder
                    )
            );


    const currentIndex =
        activeTasksArray.findIndex(
            task =>
                task.id === id
        );


    const newIndex =
        currentIndex +
        direction;


    if (
        currentIndex < 0 ||
        newIndex < 0 ||
        newIndex >=
            activeTasksArray.length
    ) {

        return;

    }


    const currentTask =
        activeTasksArray[
            currentIndex
        ];


    const targetTask =
        activeTasksArray[
            newIndex
        ];


    // Tukar posisi manual
    const tempOrder =
        currentTask.manualOrder;


    currentTask.manualOrder =
        targetTask.manualOrder;


    targetTask.manualOrder =
        tempOrder;


    saveTasks();


    // Kembali ke mode manual
    currentSort =
        "manual";


    sortSelect.value =
        "manual";


    renderTasks();

}


// ================================
// SORT
// ================================

sortSelect.addEventListener(
    "change",
    function() {

        currentSort =
            sortSelect.value;


        renderTasks();

    }
);


// ================================
// DATE
// ================================

function formatDate(
    dateString
) {

    const date =
        new Date(
            dateString +
            "T00:00:00"
        );


    return date.toLocaleDateString(
        "id-ID",
        {

            day: "2-digit",

            month: "short",

            year: "numeric"

        }
    );

}


// ================================
// CHECK OVERDUE
// ================================

function isOverdue(
    dateString
) {

    const today =
        new Date();


    today.setHours(
        0,
        0,
        0,
        0
    );


    const deadlineDate =
        new Date(
            dateString +
            "T00:00:00"
        );


    return (
        deadlineDate <
        today
    );

}


// ================================
// SECURITY
// ================================

function escapeHTML(
    text
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        text;


    return div.innerHTML;

}


// ================================
// INITIALIZE
// ================================

renderTasks();
