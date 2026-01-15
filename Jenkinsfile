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
                    corepack enable || true
                    corepack prepare pnpm@latest --activate || true
                    pnpm --version || echo "pnpm ready"
                '''
            }
        }
        stage('Download BMS XLSX (curl)') {
            steps {
                sh """
                    mkdir -p data/
                    curl -L -f "https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${GID}" \\
                         -o ${XLSX_FILE}
                    ls -la ${XLSX_FILE}
                    file ${XLSX_FILE} || echo "File check skipped"
                """
            }
        }
        stage('pnpm Install & Build') {
            steps {
                sh '''
                    pnpm install --frozen-lockfile
                    pnpm run build:dict
                    pnpm build
                '''
            }
        }
        stage('Archive') {
            steps {
                archiveArtifacts artifacts: "${XLSX_FILE},data/**,.next/**,out/**", 
                               allowEmptyArchive: true, 
                               fingerprint: true
            }
        }
    }
    post {
        always {
            echo "Build 완료: ${XLSX_FILE} 다운로드됨"
        }
        success {
            emailext to: 'team@company.com',
                     subject: "✅ BMS + Next Build #${BUILD_NUMBER}",
                     attachmentsPattern: 'BMS_*.xlsx'
        }
        failure {
            emailext to: 'team@company.com', 
                     subject: "❌ Build 실패 #${BUILD_NUMBER}"
        }
    }
}
