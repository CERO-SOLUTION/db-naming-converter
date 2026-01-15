pipeline {
    agent {
        docker {
            image 'node:18-alpine'
            args '-u root --shm-size=2g'
        }
    }
    environment {
        SHEET_ID = '1Q98LFRr_Ka1ZyBKUJ6u1vJD67F_JHIs8eovklCX_dNY'
        GID = '1543734301'
        XLSX_FILE = 'BMS_테이블_정의_V1.1.xlsx'
    }
    stages {
        stage('Install curl & Setup') {
            steps {
                sh '''
                    apk add --no-cache curl
                    corepack enable
                    corepack prepare pnpm@latest --activate
                    pnpm --version
                    curl --version
                '''
            }
        }
        stage('Download BMS XLSX') {
            steps {
                sh """
                    mkdir -p data/
                    curl -L -f "https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${GID}" \\
                         -o ${XLSX_FILE}
                    ls -la ${XLSX_FILE}
                    file ${XLSX_FILE}
                """
            }
        }
        stage('pnpm Build') {
            steps {
                sh '''
                    pnpm install --frozen-lockfile
                    pnpm run build:dict
                    pnpm b
