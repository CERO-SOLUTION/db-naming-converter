pipeline {
    agent any
    // tools 제거 - npx pnpm 사용
    environment {
        SHEET_ID = '1Q98LFRr_Ka1ZyBKUJ6u1vJD67F_JHIs8eovklCX_dNY'
        GID = '1543734301'
        XLSX_FILE = 'BMS_테이블_정의_V1.1.xlsx'
    }
    stages {
        stage('Setup pnpm') {
            steps {
                sh '''
                    npx corepack@latest enable || true
                    npx pnpm@latest --version
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
                    file ${XLSX_FILE} || echo "Excel downloaded"
                """
            }
        }
        stage('pnpm Install & Build') {
            steps {
                sh '''
                    npx pnpm@latest install --frozen-lockfile
                    npx pnpm@latest run build:dict
                    npx pnpm@latest build
                '''
            }
        }
        stage('Archive') {
            steps {
                archiveArtifacts artifacts: "${XLSX_FILE},data/**,.next/**,out/**", 
                               allowEmptyArchive: true, fingerprint: true
            }
        }
    }
    post {
        always {
            echo "✅ Build 완료: ${XLSX_FILE} 저장됨"
        }
    }
}
