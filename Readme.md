# Assignment System

1. Install PostgreSQL

2. Clone the repo from GitHub
    -> git clone https://github.com/abhijai16/Smart_Education

3. Create a database called assignment_system in PostgreSQL
    -> CREATE DATABASE assignment_system;
    -> \q   //to exit.

4. Create a .env file with the database credentials (name, user, password, host, port)
    ->  SECRET_KEY=your-random-secret-key-here
        DJANGO_DEBUG=True

        DB_NAME=assignment_system
        DB_USER=youruser
        DB_PASSWORD=yourpassword
        DB_HOST=localhost
        DB_PORT=5432

        EMAIL_HOST=smtp.gmail.com
        EMAIL_PORT=587
        EMAIL_USE_TLS=True
        EMAIL_USE_SSL=False
        EMAIL_HOST_USER=
        EMAIL_HOST_PASSWORD=

5. Create a Python virtual environment, activate it, and run pip install for all dependencies (Django, the Postgres driver, Google Gemini for the plagiarism checker, etc.)

6. Run the database migrations to build out all the tables

7. Run npm install for the frontend (React, Redux, Monaco Editor)

8. Start the central database server (python cli.py --db_server)

9. Start the worker node + frontend on a separate port to avoid conflicts (python cli.py --assignment --port 8001)

10. Create a superuser account through Django (python manage.py createsuperuser) — this automatically becomes a "teacher" account in the system

11. Log in using the Django username (not email) and the password set during superuser creation


Stack: PostgreSQL + Django backend + React front-end