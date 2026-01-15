pipeline {
    agent any
    environment {
        SHEET_ID = '1Q98LFRr_Ka1ZyBKUJ6u1vJD67F_JHIs8eovklCX_dNY'
        GID = '1543734301'
        XLSX_FILE = 'BMS_테이블_정의_V1.1.xlsx'
    }
    stages {
        stage('Install Node & pnpm') {
            steps {
                sh '''
                    # Node.js 직접 설치 (curl - Node 18)
                    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
                    apt-get install -y nodejs
                    
                    # pnpm 글로벌 설치
                    npm install -g corepack pnpm
                    
                    node --version
                    pnpm --version
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
                               allowEmptyArchive: true, fingerprint: true
            }
        }
    }
    post {
        always { echo "Build 완료: ${XLSX_FILE}" }
    }
}
