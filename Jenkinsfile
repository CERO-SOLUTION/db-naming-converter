pipeline {
    agent any
    tools { nodejs 'Node18' }
    environment {
        SHEET_ID = '1Q98LFRr_Ka1ZyBKUJ6u1vJD67F_JHIs8eovklCX_dNY'
        GID = '1543734301'
        XLSX_FILE = 'BMS_테이블_정의_V1.1.xlsx'
    }
    stages {
        stage('Setup pnpm') {
            steps {
                sh '''
                corepack enable
                corepack prepare pnpm@latest --activate
                pnpm -v
                '''
            }
        }
        stage('Download BMS XLSX (curl)') {
            steps {
                sh """
                mkdir -p data/
                # XLSX 직접 다운로드 (공개 공유 필수!)
                curl -L "https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${GID}" \\
                     -o ${XLSX_FILE}
                ls -la ${XLSX_FILE}
                echo "Downloaded XLSX: \$(file ${XLSX_FILE})"
                """
            }
        }
        stage('pnpm Install & Build') {
            steps {
                sh '''
                pnpm install
                pnpm run build:dict
                pnpm build
                '''
            }
        }
        stage('Archive') {
            steps {
                archiveArtifacts artifacts: "${XLSX_FILE},.next/**,out/**", 
                               allowEmptyArchive: false, fingerprint: true
            }
        }
    }
}